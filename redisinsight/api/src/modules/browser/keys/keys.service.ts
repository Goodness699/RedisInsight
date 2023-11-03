import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DEFAULT_MATCH, RECOMMENDATION_NAMES, RedisErrorCodes } from 'src/constants';
import { catchAclError } from 'src/utils';
import ERROR_MESSAGES from 'src/constants/error-messages';
import {
  DeleteKeysResponse,
  GetKeyInfoResponse,
  GetKeysDto,
  GetKeysInfoDto,
  GetKeysWithDetailsResponse,
  KeyTtlResponse,
  RenameKeyDto,
  RenameKeyResponse,
  UpdateKeyTtlDto,
} from 'src/modules/browser/keys/dto';
import { BrowserToolKeysCommands } from 'src/modules/browser/constants/browser-tool-commands';
import { ClientMetadata } from 'src/common/models';
import { BrowserToolService } from 'src/modules/browser/services/browser-tool/browser-tool.service';
import {
  BrowserToolClusterService,
} from 'src/modules/browser/services/browser-tool-cluster/browser-tool-cluster.service';
import { ConnectionType } from 'src/modules/database/entities/database.entity';
import { Scanner } from 'src/modules/browser/keys/scanner/scanner';
import { BrowserHistoryMode, RedisString } from 'src/common/constants';
import { plainToClass } from 'class-transformer';
import { SettingsService } from 'src/modules/settings/settings.service';
import { DatabaseService } from 'src/modules/database/database.service';
import { DatabaseRecommendationService } from 'src/modules/database-recommendation/database-recommendation.service';
import { pick } from 'lodash';
import { BrowserHistoryService } from 'src/modules/browser/browser-history/browser-history.service';
import { CreateBrowserHistoryDto } from 'src/modules/browser/browser-history/dto';
import { KeyInfoProvider } from 'src/modules/browser/keys/key-info/key-info.provider';

@Injectable()
export class KeysService {
  private logger = new Logger('KeysService');

  constructor(
    private readonly databaseService: DatabaseService,
    private browserTool: BrowserToolService,
    private browserHistory: BrowserHistoryService,
    private browserToolCluster: BrowserToolClusterService,
    private settingsService: SettingsService,
    private recommendationService: DatabaseRecommendationService,
    private readonly scanner: Scanner,
    private readonly keyInfoProvider: KeyInfoProvider,
  ) {}

  public async getKeys(
    clientMetadata: ClientMetadata,
    dto: GetKeysDto,
  ): Promise<GetKeysWithDetailsResponse[]> {
    try {
      this.logger.log('Getting keys with details.');
      // todo: refactor. no need entire entity here
      const databaseInstance = await this.databaseService.get(
        clientMetadata.databaseId,
      );
      const scanner = this.scanner.getStrategy(databaseInstance.connectionType);
      const result = await scanner.getKeys(clientMetadata, dto);

      // Do not save default match "*"
      if (dto.match !== DEFAULT_MATCH) {
        await this.browserHistory.create(
          clientMetadata,
          plainToClass(
            CreateBrowserHistoryDto,
            { filter: pick(dto, 'type', 'match'), mode: BrowserHistoryMode.Pattern },
          ),
        );
      }
      this.recommendationService.check(
        clientMetadata,
        RECOMMENDATION_NAMES.USE_SMALLER_KEYS,
        result[0]?.total,
      );

      return result.map((nodeResult) => plainToClass(GetKeysWithDetailsResponse, nodeResult));
    } catch (error) {
      this.logger.error(
        `Failed to get keys with details info. ${error.message}.`,
      );
      if (
        error.message.includes(RedisErrorCodes.CommandSyntaxError)
        && dto.type
      ) {
        throw new BadRequestException(
          ERROR_MESSAGES.SCAN_PER_KEY_TYPE_NOT_SUPPORT(),
        );
      }
      throw catchAclError(error);
    }
  }

  /**
   * Fetch additional keys info (type, size, ttl)
   * For standalone instances will use pipeline
   * For cluster instances will use single commands
   * @param clientMetadata
   * @param dto
   */
  public async getKeysInfo(
    clientMetadata: ClientMetadata,
    dto: GetKeysInfoDto,
  ): Promise<GetKeyInfoResponse[]> {
    try {
      const client = await this.browserTool.getRedisClient(clientMetadata);
      const scanner = this.scanner.getStrategy(client.isCluster ? ConnectionType.CLUSTER : ConnectionType.STANDALONE);
      const result = await scanner.getKeysInfo(client, dto.keys, dto.type);

      this.recommendationService.check(
        clientMetadata,
        RECOMMENDATION_NAMES.SEARCH_JSON,
        { keys: result, client, databaseId: clientMetadata.databaseId },
      );
      this.recommendationService.check(
        clientMetadata,
        RECOMMENDATION_NAMES.FUNCTIONS_WITH_STREAMS,
        { keys: result, client, databaseId: clientMetadata.databaseId },
      );

      return plainToClass(GetKeyInfoResponse, result);
    } catch (error) {
      this.logger.error(`Failed to get keys info: ${error.message}.`);
      throw catchAclError(error);
    }
  }

  public async getKeyInfo(
    clientMetadata: ClientMetadata,
    key: RedisString,
  ): Promise<GetKeyInfoResponse> {
    this.logger.log('Getting key info.');
    try {
      const type = await this.browserTool.execCommand(
        clientMetadata,
        BrowserToolKeysCommands.Type,
        [key],
        'utf8',
      );
      if (type === 'none') {
        this.logger.error(`Failed to get key info. Not found key: ${key}`);
        return Promise.reject(
          new NotFoundException(ERROR_MESSAGES.KEY_NOT_EXIST),
        );
      }
      const infoManager = this.keyInfoProvider.getStrategy(type);
      const result = await infoManager.getInfo(clientMetadata, key, type);
      this.logger.log('Succeed to get key info');
      this.recommendationService.check(
        clientMetadata,
        RECOMMENDATION_NAMES.BIG_SETS,
        result,
      );
      this.recommendationService.check(
        clientMetadata,
        RECOMMENDATION_NAMES.BIG_STRINGS,
        result,
      );
      this.recommendationService.check(
        clientMetadata,
        RECOMMENDATION_NAMES.COMPRESSION_FOR_LIST,
        result,
      );
      return plainToClass(GetKeyInfoResponse, result);
    } catch (error) {
      this.logger.error('Failed to get key info.', error);
      throw catchAclError(error);
    }
  }

  public async deleteKeys(
    clientMetadata: ClientMetadata,
    keys: RedisString[],
  ): Promise<DeleteKeysResponse> {
    this.logger.log('Deleting keys');
    let result;
    try {
      result = await this.browserTool.execCommand(
        clientMetadata,
        BrowserToolKeysCommands.Del,
        keys,
      );
    } catch (error) {
      this.logger.error('Failed to delete keys.', error);
      catchAclError(error);
    }
    if (!result) {
      this.logger.error('Failed to delete keys. Not Found keys');
      throw new NotFoundException();
    }
    this.logger.log('Succeed to delete keys');
    return { affected: result };
  }

  public async renameKey(
    clientMetadata: ClientMetadata,
    dto: RenameKeyDto,
  ): Promise<RenameKeyResponse> {
    this.logger.log('Renaming key');
    const { keyName, newKeyName } = dto;
    let result;
    try {
      const isExist = await this.browserTool.execCommand(
        clientMetadata,
        BrowserToolKeysCommands.Exists,
        [keyName],
      );
      if (!isExist) {
        this.logger.error(
          `Failed to rename key. ${ERROR_MESSAGES.KEY_NOT_EXIST} key: ${keyName}`,
        );
        return Promise.reject(
          new NotFoundException(ERROR_MESSAGES.KEY_NOT_EXIST),
        );
      }
      result = await this.browserTool.execCommand(
        clientMetadata,
        BrowserToolKeysCommands.RenameNX,
        [keyName, newKeyName],
      );
    } catch (error) {
      this.logger.error('Failed to rename key.', error);
      catchAclError(error);
    }
    if (!result) {
      this.logger.error(
        `Failed to rename key. ${ERROR_MESSAGES.NEW_KEY_NAME_EXIST} key: ${newKeyName}`,
      );
      throw new BadRequestException(ERROR_MESSAGES.NEW_KEY_NAME_EXIST);
    }
    this.logger.log('Succeed to rename key');
    return plainToClass(RenameKeyResponse, { keyName: newKeyName });
  }

  public async updateTtl(
    clientMetadata: ClientMetadata,
    dto: UpdateKeyTtlDto,
  ): Promise<KeyTtlResponse> {
    if (dto.ttl === -1) {
      return await this.removeKeyExpiration(clientMetadata, dto);
    }
    return await this.setKeyExpiration(clientMetadata, dto);
  }

  public async setKeyExpiration(
    clientMetadata: ClientMetadata,
    dto: UpdateKeyTtlDto,
  ): Promise<KeyTtlResponse> {
    this.logger.log('Setting a timeout on key.');
    const { keyName, ttl } = dto;
    let result;
    try {
      await this.browserTool.execCommand(
        clientMetadata,
        BrowserToolKeysCommands.Ttl,
        [keyName],
      );
      result = await this.browserTool.execCommand(
        clientMetadata,
        BrowserToolKeysCommands.Expire,
        [keyName, ttl],
      );
    } catch (error) {
      this.logger.error('Failed to set a timeout on key.', error);
      catchAclError(error);
    }
    if (!result) {
      this.logger.error(
        `Failed to set a timeout on key. ${ERROR_MESSAGES.KEY_NOT_EXIST} key: ${keyName}`,
      );
      throw new NotFoundException(ERROR_MESSAGES.KEY_NOT_EXIST);
    }
    this.logger.log('Succeed to set a timeout on key.');
    return { ttl: ttl >= 0 ? ttl : -2 };
  }

  public async removeKeyExpiration(
    clientMetadata: ClientMetadata,
    dto: UpdateKeyTtlDto,
  ): Promise<KeyTtlResponse> {
    this.logger.log('Removing the existing timeout on key.');
    const { keyName } = dto;
    try {
      const currentTtl = await this.browserTool.execCommand(
        clientMetadata,
        BrowserToolKeysCommands.Ttl,
        [keyName],
      );
      if (currentTtl === -2) {
        this.logger.error(
          `Failed to remove the existing timeout on key. ${ERROR_MESSAGES.KEY_NOT_EXIST} key: ${keyName}`,
        );
        return Promise.reject(
          new NotFoundException(ERROR_MESSAGES.KEY_NOT_EXIST),
        );
      }
      if (currentTtl > 0) {
        await this.browserTool.execCommand(
          clientMetadata,
          BrowserToolKeysCommands.Persist,
          [keyName],
        );
      }
    } catch (error) {
      this.logger.error('Failed to remove the existing timeout on key.', error);
      catchAclError(error);
    }
    this.logger.log('Succeed to remove the existing timeout on key.');
    return { ttl: -1 };
  }
}

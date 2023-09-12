import { get } from 'lodash';
import { TypeHelpOptions } from 'class-transformer';
import { CreateDatabaseCloudJobDataDto } from 'src/modules/cloud/job/dto';
import { CloudJobName } from 'src/modules/cloud/job/constants';

export const cloudJobDataTransformer = (data: TypeHelpOptions) => {
  const jobName = get(data?.object, 'name');

  switch (jobName) {
    case CloudJobName.CreateFreeDatabase:
    case CloudJobName.CreateFreeSubscription:
      return CreateDatabaseCloudJobDataDto;

    default:
      return undefined;
  }
};

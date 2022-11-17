import {
  EuiButton,
  EuiFilePicker,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiLoadingSpinner,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiText,
  EuiTextColor,
  EuiTitle
} from '@elastic/eui'
import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchInstancesAction,
  importInstancesSelector,
  resetImportInstances,
  uploadInstancesFile
} from 'uiSrc/slices/instances/instances'
import { sendEventTelemetry, TelemetryEvent } from 'uiSrc/telemetry'
import { Nullable } from 'uiSrc/utils'

import styles from './styles.module.scss'

export interface Props {
  onClose: (isCancelled: boolean) => void
}

const MAX_MB_FILE = 10
const MAX_FILE_SIZE = MAX_MB_FILE * 1024 * 1024

const ImportDatabasesDialog = ({ onClose }: Props) => {
  const { loading, data, error } = useSelector(importInstancesSelector)
  const [files, setFiles] = useState<Nullable<FileList>>(null)
  const [isInvalid, setIsInvalid] = useState<boolean>(false)
  const [isSubmitDisabled, setIsSubmitDisabled] = useState<boolean>(true)

  const dispatch = useDispatch()

  const onFileChange = (files: FileList | null) => {
    setFiles(files)
    setIsInvalid(!!files?.length && files?.[0].size > MAX_FILE_SIZE)
    setIsSubmitDisabled(!files?.length || files[0].size > MAX_FILE_SIZE)
  }

  const handleOnClose = () => {
    dispatch(resetImportInstances())
    data?.success && dispatch(fetchInstancesAction())
    onClose(!data)
  }

  const onSubmit = () => {
    if (files) {
      const formData = new FormData()
      formData.append('file', files[0])

      dispatch(uploadInstancesFile(formData))

      sendEventTelemetry({
        event: TelemetryEvent.CONFIG_DATABASES_REDIS_IMPORT_SUBMITTED
      })
    }
  }

  const isShowForm = !loading && !data && !error
  return (
    <EuiModal onClose={handleOnClose} className={styles.modal} data-testid="import-dbs-dialog">
      <EuiModalHeader>
        <EuiModalHeaderTitle>
          <EuiTitle size="xs">
            <span>Import Database Connections</span>
          </EuiTitle>
        </EuiModalHeaderTitle>
      </EuiModalHeader>

      <EuiModalBody>
        <EuiFlexGroup justifyContent="center" gutterSize="none" responsive={false}>
          <EuiFlexItem grow={false}>
            {isShowForm && (
              <>
                <EuiFilePicker
                  id="import-databases-input-file"
                  initialPromptText="Select or drag and drop a file"
                  className={styles.fileDrop}
                  isInvalid={isInvalid}
                  onChange={onFileChange}
                  display="large"
                  data-testid="import-databases-input-file"
                  aria-label="Select or drag and drop file"
                />
                {isInvalid && (
                  <EuiTextColor color="danger" className={styles.errorFileMsg} data-testid="input-file-error-msg">
                    File should not exceed {MAX_MB_FILE} mb
                  </EuiTextColor>
                )}
              </>
            )}

            {loading && (
              <div className={styles.loading} data-testid="file-loading-indicator">
                <EuiLoadingSpinner size="xl" />
                <EuiText color="subdued" style={{ marginTop: 12 }}>Uploading...</EuiText>
              </div>
            )}

            {data && data.success !== 0 && (
              <div className={styles.result} data-testid="result-success">
                <EuiIcon type="checkInCircleFilled" size="xxl" color="success" />
                <EuiText color="subdued" style={{ marginTop: 12 }}>
                  Successfully added {data.success} of {data.total} database connections
                </EuiText>
              </div>
            )}

            {(data?.success === 0 || error) && (
              <div className={styles.result} data-testid="result-failed">
                <EuiIcon type="crossInACircleFilled" size="xxl" color="danger" />
                <EuiText color="subdued" style={{ marginTop: 12 }}>
                  Failed to add database connections
                </EuiText>
              </div>
            )}
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiModalBody>

      {data && data.success !== 0 && (
        <EuiModalFooter>
          <EuiButton
            color="secondary"
            onClick={handleOnClose}
            fill
            data-testid="ok-btn"
          >
            Ok
          </EuiButton>
        </EuiModalFooter>
      )}

      {isShowForm && (
        <EuiModalFooter>
          <EuiButton
            color="secondary"
            onClick={handleOnClose}
            data-testid="cancel-btn"
          >
            Cancel
          </EuiButton>

          <EuiButton
            color="secondary"
            onClick={onSubmit}
            fill
            isDisabled={isSubmitDisabled}
            data-testid="submit-btn"
          >
            Import
          </EuiButton>
        </EuiModalFooter>
      )}
    </EuiModal>
  )
}

export default ImportDatabasesDialog

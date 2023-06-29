import React, { useState } from 'react'
import { EuiBasicTableColumn, EuiInMemoryTable, EuiText, EuiToolTip, PropertySort } from '@elastic/eui'
import cx from 'classnames'

import { useParams } from 'react-router-dom'
import { Maybe, Nullable } from 'uiSrc/utils'
import AutoRefresh from 'uiSrc/pages/browser/components/auto-refresh'
import { sendEventTelemetry, TelemetryEvent } from 'uiSrc/telemetry'
import { TriggeredFunctionsLibrary } from 'uiSrc/slices/interfaces/triggeredFunctions'
import styles from './styles.module.scss'

export interface Props {
  items: Nullable<TriggeredFunctionsLibrary[]>
  loading: boolean
  onRefresh: () => void
  lastRefresh: Nullable<number>
  selectedRow: Nullable<string>
  onSelectRow: (name: string) => void
}

const NoLibrariesMessage: React.ReactNode = (<span data-testid="no-libraries-message">No Libraries found</span>)

const LibrariesList = (props: Props) => {
  const { items, loading, onRefresh, lastRefresh, selectedRow, onSelectRow } = props
  const [sort, setSort] = useState<Maybe<PropertySort>>(undefined)

  const { instanceId } = useParams<{ instanceId: string }>()

  const columns: EuiBasicTableColumn<any>[] = [
    {
      name: 'Library Name',
      field: 'name',
      sortable: true,
      truncateText: true,
      width: '25%',
      render: (value: string) => (
        <EuiToolTip
          title="Library Name"
          content={value}
        >
          <>{value}</>
        </EuiToolTip>
      )
    },
    {
      name: 'Username',
      field: 'user',
      sortable: true,
      truncateText: true,
      width: '25%',
      render: (value: string) => (
        <EuiToolTip
          title="Username"
          content={value}
        >
          <>{value}</>
        </EuiToolTip>
      )
    },
    {
      name: 'Pending',
      field: 'pendingJobs',
      align: 'right',
      sortable: true,
      width: '140x'
    },
    {
      name: 'Total Functions',
      field: 'totalFunctions',
      align: 'right',
      width: '140px',
      sortable: true,
    },
    {
      name: '',
      field: 'actions',
      width: '20%'
    },
  ]

  const handleSelect = (item: TriggeredFunctionsLibrary) => {
    onSelectRow(item.name)
  }

  const handleRefreshClicked = () => {
    sendEventTelemetry({
      event: TelemetryEvent.TRIGGERS_AND_FUNCTIONS_LIBRARY_LIST_REFRESH_CLICKED,
      eventData: {
        databaseId: instanceId
      }
    })
  }

  const handleSorting = ({ sort }: any) => {
    setSort(sort)
    sendEventTelemetry({
      event: TelemetryEvent.TRIGGERS_AND_FUNCTIONS_LIBRARIES_SORTED,
      eventData: {
        ...sort,
        databaseId: instanceId
      }
    })
  }

  const handleEnableAutoRefresh = (enableAutoRefresh: boolean, refreshRate: string) => {
    sendEventTelemetry({
      event: enableAutoRefresh
        ? TelemetryEvent.TRIGGERS_AND_FUNCTIONS_LIBRARY_LIST_AUTO_REFRESH_ENABLED
        : TelemetryEvent.TRIGGERS_AND_FUNCTIONS_LIBRARY_LIST_AUTO_REFRESH_DISABLED,
      eventData: {
        refreshRate,
        databaseId: instanceId
      }
    })
  }

  return (
    <div className="triggeredFunctions__tableWrapper">
      <div className="triggeredFunctions__tableHeader">
        <EuiText color="subdued" size="xs" data-testid="total-libraries">Total: {items?.length || 0}</EuiText>
        <AutoRefresh
          loading={loading}
          postfix="triggered-functions-libraries"
          displayText
          lastRefreshTime={lastRefresh}
          containerClassName={styles.refreshContainer}
          onRefresh={() => onRefresh?.()}
          onRefreshClicked={handleRefreshClicked}
          onEnableAutoRefresh={handleEnableAutoRefresh}
          testid="refresh-libraries-btn"
        />
      </div>
      <EuiInMemoryTable
        loading={loading}
        items={items ?? []}
        columns={columns}
        sorting={sort ? ({ sort }) : true}
        responsive={false}
        rowProps={(row) => ({
          onClick: () => handleSelect(row),
          className: row.name === selectedRow ? 'selected' : '',
          'data-testid': `row-${row.name}`,
        })}
        message={NoLibrariesMessage}
        onTableChange={handleSorting}
        className={cx('inMemoryTableDefault', 'noBorders', 'triggeredFunctions__table')}
        data-testid="libraries-list-table"
      />
    </div>
  )
}

export default LibrariesList

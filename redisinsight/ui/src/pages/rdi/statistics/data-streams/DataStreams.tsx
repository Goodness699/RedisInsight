import { EuiBasicTableColumn } from '@elastic/eui'
import React from 'react'

import { IDataStreams } from 'uiSrc/slices/interfaces'
import Accordion from '../components/accordion'
import Panel from '../components/panel'
import Table from '../components/table'

type DataStreamsData = {
  name: string
  total: number
  pending: number
  inserted: number
  updated: number
  deleted: number
  filtered: number
  rejected: number
  deduplicated: number
  lastArrival: string
}

const columns: EuiBasicTableColumn<DataStreamsData>[] = [
  {
    name: 'Stream name',
    field: 'name',
    sortable: true
  },
  {
    name: 'Total',
    field: 'total',
    sortable: true
  },
  {
    name: 'Pending',
    field: 'pending',
    sortable: true
  },
  {
    name: 'Inserted',
    field: 'inserted',
    sortable: true
  },
  {
    name: 'Updated',
    field: 'updated',
    sortable: true
  },
  {
    name: 'Deleted',
    field: 'deleted',
    sortable: true
  },
  {
    name: 'Filtered',
    field: 'filtered',
    sortable: true
  },
  {
    name: 'Rejected',
    field: 'rejected',
    sortable: true
  },
  {
    name: 'Deduplicated',
    field: 'deduplicated',
    sortable: true
  },
  {
    name: 'Last arrival',
    field: 'lastArrival',
    sortable: true
  }
]

interface Props {
  data: IDataStreams
  loading: boolean
  onRefresh: () => void
}

const DataStreams = ({ data, loading, onRefresh }: Props) => {
  const dataStreams = Object.keys(data).map((key) => {
    const dataStream = data[key]
    return {
      name: key,
      ...dataStream
    }
  })

  return (
    <Panel>
      <Accordion id="data-streams" title="Data streams overview" loading={loading} onRefresh={onRefresh}>
        <Table<DataStreamsData> id="data-streams" columns={columns} items={dataStreams} initialSortField="name" />
      </Accordion>
    </Panel>
  )
}

export default DataStreams

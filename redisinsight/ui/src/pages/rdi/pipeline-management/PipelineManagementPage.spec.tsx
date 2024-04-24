import React from 'react'
import { cloneDeep } from 'lodash'

import reactRouterDom, { BrowserRouter } from 'react-router-dom'
import { instance, mock } from 'ts-mockito'
import { render, cleanup, mockedStore } from 'uiSrc/utils/test-utils'
import {
  appContextPipelineManagement,
  setLastPageContext,
  setLastPipelineManagementPage,
} from 'uiSrc/slices/app/context'
import { PageNames, Pages } from 'uiSrc/constants'
import PipelinePage, { Props } from './PipelineManagementPage'

const mockedProps = mock<Props>()

jest.mock('uiSrc/slices/app/context', () => ({
  ...jest.requireActual('uiSrc/slices/app/context'),
  appContextPipelineManagement: jest.fn().mockReturnValue({
    lastViewedPage: '',
  }),
}))

jest.mock('formik')

let store: typeof mockedStore
beforeEach(() => {
  cleanup()
  store = cloneDeep(mockedStore)
  store.clearActions()
})

describe('PipelinePage', () => {
  it('should render', () => {
    expect(
      render(
        <BrowserRouter>
          <PipelinePage {...instance(mockedProps)} />
        </BrowserRouter>
      )
    ).toBeTruthy()
  })

  it('should redirect to the config tab by default', () => {
    const pushMock = jest.fn()
    reactRouterDom.useHistory = jest.fn().mockReturnValue({ push: pushMock })
    reactRouterDom.useLocation = jest.fn().mockReturnValue({ pathname: Pages.rdiPipelineManagement('rdiInstanceId') })

    render(
      <BrowserRouter>
        <PipelinePage {...instance(mockedProps)} />
      </BrowserRouter>
    )

    expect(pushMock).toBeCalledWith(Pages.rdiPipelineConfig('rdiInstanceId'))
  })

  it('should redirect to the prev page from context', () => {
    (appContextPipelineManagement as jest.Mock).mockReturnValueOnce({
      lastViewedPage: Pages.rdiPipelineConfig('rdiInstanceId')
    })
    const pushMock = jest.fn()
    reactRouterDom.useHistory = jest.fn().mockReturnValue({ push: pushMock })
    reactRouterDom.useLocation = jest.fn().mockReturnValue({ pathname: Pages.rdiPipelineManagement('rdiInstanceId') })

    render(
      <BrowserRouter>
        <PipelinePage {...instance(mockedProps)} />
      </BrowserRouter>
    )

    expect(pushMock).toBeCalledWith(Pages.rdiPipelineConfig('rdiInstanceId'))
  })

  it('should save proper page on unmount', () => {
    reactRouterDom.useLocation = jest.fn().mockReturnValue({ pathname: Pages.rdiPipelineConfig('rdiInstanceId') })

    const { unmount } = render(
      <BrowserRouter>
        <PipelinePage {...instance(mockedProps)} />
      </BrowserRouter>
    )

    unmount()
    const expectedActions = [
      setLastPageContext(PageNames.rdiPipelineManagement),
      setLastPipelineManagementPage(Pages.rdiPipelineConfig('rdiInstanceId'))
    ]

    expect(store.getActions().slice(0, expectedActions.length)).toEqual(expectedActions)
  })
})

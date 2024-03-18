import { decode } from 'html-entities'
import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useHotkeys } from 'react-hotkeys-hook'
import { useHistory, useParams } from 'react-router-dom'

import {
  cliSettingsSelector,
  createCliClientAction,
  setCliEnteringCommand,
  clearSearchingCommand,
  toggleCli,
} from 'uiSrc/slices/cli/cli-settings'
import {
  concatToOutput,
  outputSelector,
  sendCliCommandAction,
  sendCliClusterCommandAction,
  processUnsupportedCommand,
  processUnrepeatableNumber,
} from 'uiSrc/slices/cli/cli-output'
import { CommandMonitor, CommandPSubscribe, CommandSubscribe, CommandHello3, Pages } from 'uiSrc/constants'
import { getCommandRepeat, isRepeatCountCorrect } from 'uiSrc/utils'
import { ConnectionType } from 'uiSrc/slices/interfaces'
import { connectedInstanceSelector } from 'uiSrc/slices/instances/instances'
import { sendEventTelemetry, TelemetryEvent } from 'uiSrc/telemetry'
import { checkUnsupportedCommand, clearOutput, cliCommandOutput } from 'uiSrc/utils/cliHelper'
import { cliTexts } from 'uiSrc/constants/cliOutput'
import { showMonitor } from 'uiSrc/slices/cli/monitor'

import CliBody from './CliBody'

import styles from './CliBody/styles.module.scss'

const CliBodyWrapper = () => {
  const [command, setCommand] = useState('')

  const history = useHistory()
  const dispatch = useDispatch()
  const { instanceId = '' } = useParams<{ instanceId: string }>()
  const { data = [] } = useSelector(outputSelector)
  const {
    errorClient: error,
    unsupportedCommands,
    isEnteringCommand,
    isSearching,
    matchedCommand,
    cliClientUuid,
  } = useSelector(cliSettingsSelector)
  const { connectionType } = useSelector(connectedInstanceSelector)
  const { db: currentDbIndex } = useSelector(outputSelector)

  useEffect(() => {
    !cliClientUuid && dispatch(createCliClientAction(instanceId, handleWorkbenchClick))
  }, [])

  useEffect(() => {
    if (!isEnteringCommand) {
      dispatch(setCliEnteringCommand())
    }
    if (isSearching && matchedCommand) {
      dispatch(clearSearchingCommand())
    }
  }, [command])

  const handleClearOutput = () => {
    clearOutput(dispatch)
  }

  const handleWorkbenchClick = () => {
    dispatch(toggleCli())
    history.push(Pages.workbench(instanceId))

    sendEventTelemetry({
      event: TelemetryEvent.CLI_WORKBENCH_LINK_CLICKED,
      eventData: {
        databaseId: instanceId
      }
    })
  }

  const refHotkeys = useHotkeys<HTMLDivElement>('command+k,ctrl+l', handleClearOutput)

  const handleSubmit = () => {
    const [commandLine, countRepeat] = getCommandRepeat(decode(command).trim() || '')
    const unsupportedCommand = checkUnsupportedCommand(unsupportedCommands, commandLine)
    dispatch(concatToOutput(cliCommandOutput(decode(command), currentDbIndex)))

    if (!isRepeatCountCorrect(countRepeat)) {
      dispatch(processUnrepeatableNumber(commandLine, resetCommand))
      return
    }

    // Flow if MONITOR command was executed
    if (checkUnsupportedCommand([CommandMonitor.toLowerCase()], commandLine)) {
      dispatch(concatToOutput(cliTexts.MONITOR_COMMAND_CLI(() => { dispatch(showMonitor()) })))
      resetCommand()
      return
    }

    // Flow if PSUBSCRIBE command was executed
    if (checkUnsupportedCommand([CommandPSubscribe.toLowerCase()], commandLine)) {
      dispatch(concatToOutput(cliTexts.PSUBSCRIBE_COMMAND_CLI(Pages.pubSub(instanceId))))
      resetCommand()
      return
    }

    // Flow if SUBSCRIBE command was executed
    if (checkUnsupportedCommand([CommandSubscribe.toLowerCase()], commandLine)) {
      dispatch(concatToOutput(cliTexts.SUBSCRIBE_COMMAND_CLI(Pages.pubSub(instanceId))))
      resetCommand()
      return
    }

    // Flow if HELLO 3 command was executed
    if (checkUnsupportedCommand([CommandHello3.toLowerCase()], commandLine)) {
      dispatch(concatToOutput(cliTexts.HELLO3_COMMAND_CLI()))
      resetCommand()
      return
    }

    if (unsupportedCommand) {
      dispatch(processUnsupportedCommand(commandLine, unsupportedCommand, resetCommand))
      return
    }

    for (let i = 0; i < countRepeat; i++) {
      sendCommand(commandLine)
    }
  }

  const sendCommand = (command: string) => {
    sendEventTelemetry({
      event: TelemetryEvent.CLI_COMMAND_SUBMITTED,
      eventData: {
        databaseId: instanceId
      }
    })
    if (connectionType !== ConnectionType.Cluster) {
      dispatch(sendCliCommandAction(command, resetCommand))
      return
    }

    dispatch(sendCliClusterCommandAction(command, resetCommand))
  }

  const resetCommand = () => {
    setCommand('')
  }

  return (
    <section ref={refHotkeys} className={styles.section}>
      <CliBody
        data={data}
        command={command}
        error={error}
        setCommand={setCommand}
        onSubmit={handleSubmit}
      />
    </section>
  )
}

export default CliBodyWrapper

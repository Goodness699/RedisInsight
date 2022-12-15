import React from 'react'
import { useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import { isNull } from 'lodash'
import {
  EuiAccordion,
  EuiPanel,
  EuiText,
} from '@elastic/eui'
import { dbAnalysisSelector } from 'uiSrc/slices/analytics/dbAnalysis'
import recommendationsContent from 'uiSrc/constants/dbAnalysisRecommendations.json'
import { sendEventTelemetry, TelemetryEvent } from 'uiSrc/telemetry'

import { renderContent, renderBadges } from './utils'
import styles from './styles.module.scss'

const Recommendations = () => {
  const { data, loading } = useSelector(dbAnalysisSelector)
  const { recommendations = [] } = data ?? {}

  const { instanceId } = useParams<{ instanceId: string }>()

  const handleToggle = (isOpen: boolean, id: string) => sendEventTelemetry({
    event: isOpen
      ? TelemetryEvent.DATABASE_ANALYSIS_RECOMMENDATIONS_EXPANDED
      : TelemetryEvent.DATABASE_ANALYSIS_RECOMMENDATIONS_COLLAPSED,
    eventData: {
      databaseId: instanceId,
      recommendation: id,
    }
  })

  if (loading) {
    return (
      <div className={styles.loadingWrapper} data-testid="recommendations-loader" />
    )
  }

  if (isNull(recommendations) || !recommendations.length) {
    return (
      <div className={styles.container} data-testid="empty-recommendations-message">
        <EuiText size="m">No Recommendations at the moment.</EuiText>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      {recommendations.map(({ name }) => {
        const { id = '', title = '', content = '', badges = [] } = recommendationsContent[name]
        return (
          <div key={id} className={styles.recommendation}>
            <EuiAccordion
              id={name}
              arrowDisplay="right"
              buttonContent={title}
              buttonClassName={styles.accordionBtn}
              buttonProps={{ 'data-test-subj': `${id}-button` }}
              className={styles.accordion}
              initialIsOpen
              onToggle={(isOpen) => handleToggle(isOpen, id)}
              data-testId={`${id}-accordion`}
            >
              <EuiPanel className={styles.accordionContent} color="subdued">
                {renderContent(content)}
              </EuiPanel>
            </EuiAccordion>
            <div>
              {renderBadges(badges)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default Recommendations

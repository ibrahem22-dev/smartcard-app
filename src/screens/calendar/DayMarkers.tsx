import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { RtlRow } from '../../components/rtl';
import { useTranslation } from '../../hooks/useTranslation';
import {
  evaluateSurfaceEngines,
  type SurfaceContext,
  type SurfaceEngineResults,
} from '../../surfaces';
import {
  ROLE_BORDER,
  ROLE_SURFACE_BG,
  ROLE_TEXT,
  TEXT,
} from '../../theme/tokens';
import { riskPresentation } from '../../theme/riskPresentation';
import { markersFor, type DayMarker } from './dayMarkers';

export interface DayMarkersProps {
  readonly iso: string;
  readonly results?: SurfaceEngineResults;
  readonly context?: SurfaceContext;
}

function Marker({ iso, marker }: { readonly iso: string; readonly marker: DayMarker }): React.ReactElement {
  const { t } = useTranslation();
  const testID = `calendar-day-${iso}-marker-${marker.kind}`;

  if (marker.kind === 'risk') {
    const level = marker.level ?? 'unknown';
    const presentation = riskPresentation(level);
    return (
      <View
        accessibilityLabel={`${t('סיכון')}: ${t(presentation.labelKey)}`}
        accessibilityRole="image"
        accessibilityValue={{ text: t(presentation.labelKey) }}
        className={`h-4 w-4 items-center justify-center rounded-full border ${presentation.className}`}
        testID={testID}
      >
        <AppText
          className={`text-[12px] font-black ${ROLE_TEXT.neutral}`}
          testID={`${testID}-cue`}
        >
          {presentation.cue}
        </AppText>
      </View>
    );
  }

  if (marker.kind === 'salary') {
    return (
      <View
        accessibilityLabel={t('משכורת')}
        accessibilityRole="image"
        className={`h-4 w-4 items-center justify-center rounded-full border ${ROLE_SURFACE_BG.neutral} ${ROLE_BORDER.neutral}`}
        testID={testID}
      >
        <AppText
          className={`text-[12px] font-black ${ROLE_TEXT.neutral}`}
          testID={`${testID}-cue`}
        >
          ₪
        </AppText>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={t('חיוב כרטיס')}
      accessibilityRole="image"
      className={`h-4 w-4 items-center justify-center border ${ROLE_SURFACE_BG.neutral} ${ROLE_BORDER.neutral}`}
      testID={testID}
    >
      <AppText
        className={`text-[12px] font-black ${ROLE_TEXT.neutral}`}
        testID={`${testID}-cue`}
      >
        ▣
      </AppText>
    </View>
  );
}

export function DayMarkers({
  iso,
  results,
  context,
}: DayMarkersProps): React.ReactElement | null {
  const activeResults = results ?? (context === undefined ? undefined : evaluateSurfaceEngines(context));
  if (activeResults === undefined) return null;
  const markers = markersFor(activeResults, iso);
  if (markers.length === 0) return null;

  return (
    <RtlRow className="items-center gap-0.5">
      {markers.map((marker) => (
        <Marker iso={iso} key={marker.kind} marker={marker} />
      ))}
    </RtlRow>
  );
}

export function DayMarkersLegend(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View className="items-center px-2 py-1" testID="calendar-legend">
      <AppText className={`text-xs ${TEXT.secondary}`} numberOfLines={1}>
        {t('סיכון')} · {t('משכורת')} · {t('חיוב כרטיס')}
      </AppText>
    </View>
  );
}

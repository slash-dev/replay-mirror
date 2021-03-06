import {createFeatureSelector, createSelector} from '@ngrx/store';
import {State} from '../reducers';
import {TimeState, ViewerState} from '../reducers/viewer.reducer';
import {timeToDelayMs} from './timeUtils';

export const viewerStateSelector = createFeatureSelector<State, ViewerState>('viewer');

export const timeStateSelector = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.timeState,
);

export const isAtEnd = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.isLive || state.isStopped,
);
export const statusSelector = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.status,
);

export const isWaiting = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.waitTimeS <= 0,
);

export const isStopped = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.isStopped,
);

export const isLive = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.isLive,
);

export const isEnded = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.isEnded,
);

export const delayMs = createSelector(
  viewerStateSelector,
  timeStateSelector,
  isLive,
  (state: ViewerState, timeState: TimeState, isLive: boolean) =>
    isLive || timeState.currentTimeS == null || state.timeStarted == null
      ? 0
      : timeToDelayMs(timeState.currentTimeS * 1000, timeState.now, state.timeStarted),
);

export const displayedDelay = createSelector(
  delayMs,
  (delayMs: number) => delayMs / 1000,
);

export const targetS = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.targetDelayMs / 1000,
);

export const totalTimeS = createSelector(
  viewerStateSelector,
  timeStateSelector,
  (state: ViewerState, timeState: TimeState) => {
    if (state.isEnded) {
      return timeState.bufferedTimeRangeEndS || 0;
    } else {
      if (!state.timeStarted) {
        return 0;
      }
      return (timeState.now.getTime() - state.timeStarted.getTime()) / 1000;
    }
  },
);

export const currentTimeS = createSelector(
  timeStateSelector,
  isLive,
  totalTimeS,
  (timeState: TimeState, isLive: boolean, totalTimeS: number) =>
    isLive || timeState.currentTimeS == null ? totalTimeS : timeState.currentTimeS,
);

export const changeDelayParams = createSelector(
  viewerStateSelector,
  (state: ViewerState) => ({
    targetMs: state.targetDelayMs,
    isEnded: state.isEnded,
    timeStarted: state.timeStarted,
    bufferedTimeRangeEndS: state.timeState.bufferedTimeRangeEndS,
  }),
);

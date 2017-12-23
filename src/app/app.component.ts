import 'rxjs/add/observable/interval';
import 'rxjs/add/observable/from';
import 'rxjs/add/observable/timer';
import 'rxjs/add/operator/take';
import 'rxjs/add/operator/concat';
import 'rxjs/add/operator/switchMap';

import {Component} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import {Subject} from 'rxjs/Subject';

declare type MediaRecorder;
declare var MediaRecorder: any;

type UserAction = 'more' | 'less' | 'stopRecord' | 'stop';

type PauseAction = {
  kind: 'Pause'
};
type PlayAction = {
  kind: 'Play'
};
type StopRecordAction = {
  kind: 'StopRecord'
};
type StopAction = {
  kind: 'Stop'
};
type SetLiveAction = {
  kind: 'SetLive'
};
type SetTimeAction = {
  kind: 'SetTime',
  timeS: number
};
type SetWaitingAction = {
  kind: 'SetWaiting',
  timeS: number
};

type PlayerAction = PauseAction | PlayAction | StopAction | StopRecordAction |
    SetTimeAction | SetLiveAction | SetWaitingAction;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  targetMs = 0;
  private skip = false;
  private mediaStream: MediaStream|null;
  private mediaRecorder: MediaRecorder|null;
  private adjustIntervalId: number|null;
  private video: HTMLVideoElement;
  private liveVideo: HTMLVideoElement;
  private preview: HTMLVideoElement;
  private lastReceived: Date|null = null;
  private bufferSource = new MediaSource();
  private sourceBuffer: SourceBuffer|null;
  isEnded = false;
  isStopped = false;
  isStalled = false;
  isLive = true;
  isInitialized = false;
  isUnsupportedBrowser = false;
  isPermissionDeniedError = false;
  isNotFoundError = false;
  isUnknownError = false;
  displayedDelay = 0;
  waitTime = 0;
  showPreview_ = false;

  private userActions = new Subject<UserAction>();
  private playerActions: Observable<PlayerAction>;

  constructor() {
    this.targetMs = 0;
    this.skip = false;
    this.mediaStream = null;
    this.adjustIntervalId = null;

    this.playerActions = this.userActions.switchMap(
        (userAction) => this.executeUserAction(userAction));
    this.playerActions.subscribe(
        (action) => { this.executePlayerAction(action); });
    Observable.interval(200).subscribe(() => this.showDelay());
  }

  ngOnInit() {
    this.video = document.querySelector('#video') as HTMLVideoElement;
    this.liveVideo = document.querySelector('#live') as HTMLVideoElement;
    this.preview = document.querySelector('#preview') as HTMLVideoElement;
    this.video.addEventListener('stalled', () => { this.isStalled = true; });
    this.start();
  }

  getMimeType(): string|undefined {
    try {
      return ['video/webm\;codecs=vp9', 'video/webm\;codecs=vp8'].find(
          (mimeType) => MediaRecorder.isTypeSupported(mimeType));
    } catch (e) {
      return undefined;
    }
  }

  start() {
    const mimeType = this.getMimeType();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia ||
        !mimeType) {
      this.isUnsupportedBrowser = true;
      return;
    }

    navigator.mediaDevices.getUserMedia({video: true})
        .then((mediaStream) => {
          this.mediaStream = mediaStream;
          this.mediaRecorder =
              new MediaRecorder(mediaStream, {mimeType: mimeType}) as any;
          this.bufferSource.addEventListener('sourceopen', () => {
            this.sourceBuffer = this.bufferSource.addSourceBuffer(mimeType);

            this.mediaRecorder.ondataavailable = (e) => {
              if (this.isEnded) {
                return;
              }
              this.lastReceived = new Date();
              const fileReader = new FileReader();
              fileReader.onload = (f) => {
                this.sourceBuffer.appendBuffer((f.target as any).result);
              };
              fileReader.readAsArrayBuffer(e.data);
            };
            this.mediaRecorder.start();
            this.mediaRecorder.requestData();
            Observable.interval(1000).subscribe(() => {
              if (!this.isEnded) {
                this.mediaRecorder.requestData();
              }
            });
            this.isInitialized = true;
          });
          this.isLive = true;
          this.video.src = window.URL.createObjectURL(this.bufferSource);
          this.video.pause();
          this.liveVideo.src = window.URL.createObjectURL(this.mediaStream);
          this.liveVideo.play();
          this.preview.src = window.URL.createObjectURL(this.mediaStream);
          this.preview.pause();
        })
        .catch((e) => {
          if (e.name === 'PermissionDeniedError' ||  // Chrome
              e.name === 'NotAllowedError') {        // Firefox
            this.isPermissionDeniedError = true;
          } else if (e.name === 'NotFoundError') {
            this.isNotFoundError = true;
          } else {
            this.isUnknownError = true;
            console.log(e);
          }
        });

    //    document.addEventListener('visibilitychange', () =>
    //      {
    //        if (document.visibilityState === 'visible') {
    //          this.changeDelay(0);
    //        }
    //      });
    //
    //    this.adjustIntervalId = window.setInterval(() => {
    //      if (!this.skip && this.video.currentTime !== undefined &&
    //      this.video.buffered.length > 0) {
    //        console.log('currentTime: ', this.video.currentTime,
    //            'buffer end: ', this.video.buffered.end(0),
    //            'delay: ', this.delayMs,
    //            'delta: ', this.target - this.delayMs);
    //
    //        if (Math.abs(this.target - this.delayMs) > 500) {
    //          this.showDelay();
    //          this.changeDelay(0);
    //        } else {
    //          let rate = Math.pow(1.5, (this.delayMs - this.target)/1000);
    //          if (Math.abs(rate - 1) < 0.01) {
    //            rate = 1;
    //          }
    //          this.video.playbackRate = rate;
    //          console.log('playback rate: ', rate);
    //          this.showDelay();
    //        }
    //      }
    //    }, 1000);
  }

  less() { this.userActions.next('less'); }

  more() { this.userActions.next('more'); }

  stop() { this.userActions.next('stop'); }

  stopRecord() { this.userActions.next('stopRecord'); }

  togglePreview() { this.showPreview = !this.showPreview; }

  set showPreview(value) {
    if (this.preview) {
      if (value) {
        this.preview.play();
      } else {
        this.preview.pause();
      }
    }
    this.showPreview_ = value;
  }

  get showPreview() { return this.showPreview_; }

  get isError() {
    return this.isNotFoundError || this.isPermissionDeniedError ||
        this.isUnsupportedBrowser;
  }

  executeUserAction(action: UserAction): Observable<PlayerAction> {
    switch (action) {
      case 'less':
        return this.changeDelay(-5000);
      case 'more':
        return this.changeDelay(5000);
      case 'stopRecord':
        return Observable.from([{kind: 'StopRecord' as 'StopRecord'}])
            .concat(this.changeDelay(0, true));
      case 'stop':
        return Observable.from([{kind: 'Stop' as 'Stop'}]);
      default:
        const checkExhaustive: never = action;
    }
  }

  changeDelay(ms, noWait = false): Observable<PlayerAction> {
    this.skip = true;
    this.targetMs = this.isEnded ?
        Math.max(this.delayMs + ms, this.timeSinceLastReceivedMs) :
        Math.max(this.targetMs + ms, 0);
    if (noWait || this.isEnded) {
      console.log('stopping', this.targetMs);
      this.targetMs = Math.min(this.targetMs, this.absoluteEndMs);
    }
    const headroom = this.absoluteEndMs - this.targetMs;
    if (headroom < 0) {
      const periods = Math.floor(-headroom / 1000) + 1;
      const x = new Date();
      return Observable
          .from([
            {kind: 'Pause' as 'Pause'},
            {kind: ('SetTime' as 'SetTime'), timeS: 0},
            {kind: ('SetWaiting' as 'SetWaiting'), timeS: periods},
          ])
          .concat(Observable.timer((-headroom) % 1000, 1000)
                      .take(periods)
                      .switchMap((i: number): Observable<PlayerAction> => {
                        const x = new Date();
                        if (i < periods - 1) {
                          return Observable.from([{
                            kind: ('SetWaiting' as 'SetWaiting'),
                            timeS: periods - 1 - i
                          }]);
                        } else {
                          return Observable.from([{kind: ('Play' as 'Play')}]);
                        }
                      }));
    } else {
      if (this.timeSinceLastReceivedMs > this.targetMs) {
        return Observable.from([{kind: ('SetLive' as 'SetLive')}]);
      }
      return Observable.from([
        {
          kind: 'SetTime' as 'SetTime',
          timeS: (this.absoluteEndMs - this.targetMs) / 1000
        },
        {kind: ('Play' as 'Play')}
      ]);
    }
  }

  executePlayerAction(action: PlayerAction) {
    switch (action.kind) {
      case 'SetLive':
        console.log('set live');
        if (!this.isLive) {
          this.showPreview = false;
          this.liveVideo.play();
          this.video.pause();
          this.isLive = true;
        }
        break;
      case 'Play':
        console.log('playing');
        this.switchToDelayed();
        this.waitTime = 0;
        this.isStalled = false;
        this.showDelay();
        break;
      case 'Pause':
        console.log('pausing');
        this.switchToDelayed();
        this.video.pause();
        this.showDelay();
        break;
      case 'SetTime':
        console.log('setting time', action);
        this.video.currentTime = action.timeS;
        this.showDelay();
        break;
      case 'SetWaiting':
        console.log('setting waiting', action);
        this.video.currentTime = 0;
        this.waitTime = action.timeS;
        this.showDelay();
        break;
      case 'Stop':
        console.log('stopping');
        this.video.pause();
        this.isStopped = true;
        break;
      case 'StopRecord':
        console.log('stop recording');
        this.isEnded = true;
        this.showPreview = false;
        this.switchToDelayed();
        if (this.mediaStream) {
          for (const mediaStreamTrack of this.mediaStream.getTracks()) {
            mediaStreamTrack.stop();
          }
        }
        if (this.mediaRecorder) {
          this.mediaRecorder.stop();
        }
        if (this.adjustIntervalId) {
          window.clearInterval(this.adjustIntervalId);
        }
        break;
      default:
        const checkExhaustive: never = action;
    }
  }

  switchToDelayed() {
    if (this.isLive) {
      this.liveVideo.pause();
      this.video.play();
      this.isLive = false;
    }
  }

  get isAtEnd() { return this.isLive || this.isStalled; }

  get timeSinceLastReceivedMs() {
    const now = new Date().getTime();
    return now - this.lastReceived.getTime();
  }

  get absoluteEndMs() {
    if (!this.lastReceived || this.sourceBuffer.buffered.length === 0) {
      return 0;
    }
    const result = 1000 * this.sourceBuffer.buffered.end(0);
    //    if (this.isEnded) {
    //      return result;
    //    }
    return result + this.timeSinceLastReceivedMs;
  }

  get delayMs() {
    if (this.isLive) {
      return 0;
    } else {
      return this.absoluteEndMs - this.video.currentTime * 1000;
    }
  }

  get isWaiting() { return this.waitTime <= 0; }

  showDelay() { this.displayedDelay = this.delayMs / 1000; }
}

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { Subscription } from 'rxjs';
import { PeerService, Call } from '../services/peer.service';
import { MediaConnection } from 'peerjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-video-chat',
  standalone: true,
  imports: [CommonModule, FormsModule,],
  templateUrl: './video-chat.html',
  styleUrls: ['./video-chat.css']
})
export class VideoChatComponent implements OnInit, OnDestroy {
  @Input() channelId: string = '';
  @Input() currentUser: any;
  @Output() callEnded = new EventEmitter<void>();
  @Input() targetUser: any; // Add this input
  @Input() autoStartCall: 'video' | 'audio' | null = null;

  // State
  peerId: string = '';
  remotePeerId: string = '';
  isConnected: boolean = false;
  isInCall: boolean = false;
  isCallIncoming: boolean = false;
  incomingCall: any = null;
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;
  callType: 'video' | 'audio' | null = null;

  // UI state
  isVideoEnabled: boolean = true;
  isAudioEnabled: boolean = true;
  isCalling: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(private peerService: PeerService) {}

  ngOnInit(): void {
    this.initializeVideoChat();
    this.setupEventListeners();

    if (this.targetUser && this.autoStartCall) {
      setTimeout(() => {
        this.startCallWithTargetUser();
      }, 1000);
    }
  }


  private async startCallWithTargetUser(): Promise<void> {
    if (!this.targetUser?.peerId) {
      console.error('Target user does not have a peer ID');
      return;
    }

    this.remotePeerId = this.targetUser.peerId;
    
    try {
      if (this.autoStartCall === 'video') {
        await this.startVideoCall();
      } else if (this.autoStartCall === 'audio') {
        await this.startAudioCall();
      }
    } catch (error) {
      console.error('Failed to start call:', error);
    }
  }

  

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Initialize video chat
   */
  private initializeVideoChat(): void {
    this.peerId = this.peerService.getPeerId();
    this.isConnected = this.peerService.isConnected();

    // Get local media stream for preview
    this.peerService.getUserMedia({ video: true, audio: true })
      .then(stream => {
        this.localStream = stream;
      })
      .catch(error => {
        console.error('Failed to get local media:', error);
      });
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for incoming calls
    this.subscriptions.push(
      this.peerService.onCall().subscribe(call => {
        this.handleIncomingCall(call);
      })
    );

    // Listen for remote stream
    this.subscriptions.push(
      this.peerService.onStream().subscribe(stream => {
        this.remoteStream = stream;
      })
    );

    // Listen for call ended
    this.subscriptions.push(
      this.peerService.onCallEnded().subscribe(peerId => {
        this.handleCallEnded();
      })
    );

    // Listen for errors
    this.subscriptions.push(
      this.peerService.onError().subscribe(error => {
        this.handleError(error);
      })
    );

    // Listen for state changes
    this.subscriptions.push(
      this.peerService.getState().subscribe(state => {
        this.isInCall = state.isInCall;
        this.callType = state.callType;
        this.remoteStream = state.remoteStream;
      })
    );

    // Listen for peer connection
    this.subscriptions.push(
      this.peerService.onPeerConnected().subscribe(peerId => {
        this.isConnected = true;
        this.peerId = peerId;
      })
    );
  }

  /**
   * Handle incoming call
   */
  private handleIncomingCall(call: MediaConnection): void {
    this.incomingCall = call;
    this.isCallIncoming = true;
    this.callType = call.metadata?.callType || 'video';
  }

  /**
   * Start a video call
   */
  async startVideoCall(): Promise<void> {
    if (!this.remotePeerId.trim()) {
      alert('Please enter a peer ID');
      return;
    }

    this.isCalling = true;
    try {
      await this.peerService.startVideoCall(this.remotePeerId);
      this.isInCall = true;
      this.callType = 'video';
    } catch (error) {
      console.error('Failed to start video call:', error);
      alert('Failed to start video call. Please check the peer ID and try again.');
    } finally {
      this.isCalling = false;
    }
  }

  /**
   * Start an audio call
   */
  async startAudioCall(): Promise<void> {
    if (!this.remotePeerId.trim()) {
      alert('Please enter a peer ID');
      return;
    }

    this.isCalling = true;
    try {
      await this.peerService.startAudioCall(this.remotePeerId);
      this.isInCall = true;
      this.callType = 'audio';
    } catch (error) {
      console.error('Failed to start audio call:', error);
      alert('Failed to start audio call. Please check the peer ID and try again.');
    } finally {
      this.isCalling = false;
    }
  }

  /**
   * Answer incoming call
   */
  async answerCall(accept: boolean = true): Promise<void> {
    if (this.incomingCall) {
      await this.peerService.answerCall(this.incomingCall, accept);
      if (accept) {
        this.isInCall = true;
        this.isCallIncoming = false;
      } else {
        this.isCallIncoming = false;
      }
      this.incomingCall = null;
    }
  }

  /**
   * End current call
   */
  endCall(): void {
    this.peerService.endCurrentCall();
    this.handleCallEnded();
  }

  /**
   * Handle call ended
   */
  private handleCallEnded(): void {
    this.isInCall = false;
    this.isCallIncoming = false;
    this.incomingCall = null;
    this.remoteStream = null;
    this.callType = null;
    this.callEnded.emit();
  }

  /**
   * Toggle video
   */
  toggleVideo(): void {
    this.isVideoEnabled = !this.isVideoEnabled;
    this.peerService.toggleVideo(this.isVideoEnabled);
  }

  /**
   * Toggle audio
   */
  toggleAudio(): void {
    this.isAudioEnabled = !this.isAudioEnabled;
    this.peerService.toggleAudio(this.isAudioEnabled);
  }

  /**
   * Handle errors
   */
  private handleError(error: any): void {
    console.error('Video chat error:', error);
    let errorMessage = 'An error occurred';

    if (error.type === 'peer-unavailable') {
      errorMessage = 'The user is unavailable. Please check the peer ID.';
    } else if (error.type === 'network') {
      errorMessage = 'Network error. Please check your connection.';
    } else if (error.type === 'permission-denied') {
      errorMessage = 'Camera/microphone permission denied.';
    }

    alert(errorMessage);
  }

  /**
   * Copy peer ID to clipboard
   */
  copyPeerId(): void {
    navigator.clipboard.writeText(this.peerId)
      .then(() => {
        alert('Peer ID copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy peer ID:', err);
      });
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.isInCall) {
      this.endCall();
    }
  }
}
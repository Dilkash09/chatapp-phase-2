import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { Subscription } from 'rxjs';
import { PeerService } from '../services/peer.service';
import { MediaConnection } from 'peerjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-video-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './video-chat.html',
  styleUrls: ['./video-chat.css']
})
export class VideoChatComponent implements OnInit, OnDestroy {
  @Input() channelId: string = '';
  @Input() currentUser: any;
  @Output() callEnded = new EventEmitter<void>();
  @Input() targetUser: any;
  @Input() autoStartCall: 'video' | 'audio' | null = null;

  // State
  peerId: string = '';
  remotePeerId: string = '';
  isConnected: boolean = false;
  isInCall: boolean = false;
  isCallIncoming: boolean = false;
  incomingCall: MediaConnection | null = null;
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
    console.log('🎬 VideoChatComponent Initialized');
    console.log('Target User:', this.targetUser);
    console.log('Auto Start Call:', this.autoStartCall);
    
    this.initializeVideoChat();
    this.setupEventListeners();

    if (this.targetUser && this.autoStartCall) {
      console.log('⏳ Waiting to start call...');
      setTimeout(() => {
        this.startCallWithTargetUser();
      }, 2000);
    }
  }

  private async startCallWithTargetUser(): Promise<void> {
    console.log('🚀 Starting call with target user');
    console.log('Target User:', this.targetUser);
    
    if (!this.targetUser?.peerId) {
      console.error('❌ Target user missing peer ID');
      alert('Target user is not available for calls (missing peer ID)');
      return;
    }

    this.remotePeerId = this.targetUser.peerId;
    console.log('🎯 Remote Peer ID:', this.remotePeerId);
    console.log('📞 Call Type:', this.autoStartCall);

    // Wait for peer connection
    if (!this.isConnected) {
      console.log('⏳ Waiting for peer connection...');
      await this.waitForPeerConnection();
    }

    try {
      console.log(`🎬 Starting ${this.autoStartCall} call...`);
      
      if (this.autoStartCall === 'video') {
        await this.startVideoCall();
      } else if (this.autoStartCall === 'audio') {
        await this.startAudioCall();
      }
      
      console.log('✅ Call initiation completed');
    } catch (error: any) {
      console.error('❌ Failed to start call:', error);
      alert(`Failed to start call: ${error.message}`);
    }
  }

  private waitForPeerConnection(timeout: number = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      const checkInterval = setInterval(() => {
        if (this.isConnected) {
          clearInterval(checkInterval);
          clearTimeout(timeoutId);
          console.log('✅ Peer connection established');
          resolve();
        }
      }, 100);

      const timeoutId = setTimeout(() => {
        clearInterval(checkInterval);
        console.error('❌ Peer connection timeout');
        reject(new Error('Peer connection timeout. Please refresh and try again.'));
      }, timeout);
    });
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private initializeVideoChat(): void {
    this.peerId = this.peerService.getPeerId();
    this.isConnected = this.peerService.isConnected();
    console.log('🔗 Peer ID:', this.peerId);
    console.log('📡 Connected:', this.isConnected);

    // Get local media stream for preview
    this.peerService.getUserMedia({ video: true, audio: true })
      .then(stream => {
        this.localStream = stream;
        console.log('✅ Local media stream obtained');
      })
      .catch(error => {
        console.error('❌ Failed to get local media:', error);
      });
  }

  private setupEventListeners(): void {
    // Listen for peer ID changes - UPDATED METHOD NAME
    this.subscriptions.push(
      this.peerService.onPeerId().subscribe((peerId: string) => {
        if (peerId) {
          console.log('✅ Peer connected:', peerId);
          this.isConnected = true;
          this.peerId = peerId;
        } else {
          console.log('❌ Peer disconnected');
          this.isConnected = false;
          this.peerId = '';
        }
      })
    );

    // Listen for connection state changes - UPDATED METHOD NAME
    this.subscriptions.push(
      this.peerService.onConnectionState().subscribe((isConnected: boolean) => {
        console.log('📡 Connection state:', isConnected);
        this.isConnected = isConnected;
      })
    );

    // Listen for incoming calls - UPDATED METHOD NAME
    this.subscriptions.push(
      this.peerService.onIncomingCall().subscribe((call: MediaConnection) => {
        console.log('📞 Incoming call received from:', call.peer);
        this.handleIncomingCall(call);
      })
    );

    // Listen for remote stream
    this.subscriptions.push(
      this.peerService.onStream().subscribe(stream => {
        if (stream) {
          console.log('📹 Remote stream received');
          this.remoteStream = stream;
        } else {
          console.log('📹 Remote stream ended');
          this.remoteStream = null;
        }
      })
    );

    // Listen for call ended - UPDATED TYPE (now void)
    this.subscriptions.push(
      this.peerService.onCallEnded().subscribe(() => {
        console.log('📞 Call ended');
        this.handleCallEnded();
      })
    );

    // Listen for errors
    this.subscriptions.push(
      this.peerService.onError().subscribe(error => {
        if (error) {
          console.error('❌ Peer error:', error);
          this.handleError(error);
        }
      })
    );

    // Listen for state changes
    this.subscriptions.push(
      this.peerService.getState().subscribe(state => {
        this.isInCall = state.isInCall;
        this.callType = state.callType;
        this.remoteStream = state.remoteStream;
        this.localStream = state.localStream;
        
        // Update UI states based on call state
        if (state.localStream) {
          const videoTrack = state.localStream.getVideoTracks()[0];
          const audioTrack = state.localStream.getAudioTracks()[0];
          this.isVideoEnabled = videoTrack?.enabled ?? true;
          this.isAudioEnabled = audioTrack?.enabled ?? true;
        }
      })
    );
  }

  private handleIncomingCall(call: MediaConnection): void {
    console.log('📞 Handling incoming call from:', call.peer);
    this.incomingCall = call;
    this.isCallIncoming = true;
    
    // Extract call type from metadata
    const metadata = call.metadata as any;
    this.callType = metadata?.callType || 'video';
    
    console.log('📞 Incoming call type:', this.callType);
  }

  async startVideoCall(): Promise<void> {
    if (!this.remotePeerId.trim()) {
      alert('Please enter a peer ID');
      return;
    }

    console.log('🎥 Starting video call to:', this.remotePeerId);
    this.isCalling = true;
    
    try {
      await this.peerService.startVideoCall(this.remotePeerId);
      this.isInCall = true;
      this.callType = 'video';
      console.log('✅ Video call started successfully');
    } catch (error: any) {
      console.error('❌ Failed to start video call:', error);
      alert(`Failed to start video call: ${error.message}`);
    } finally {
      this.isCalling = false;
    }
  }

  async startAudioCall(): Promise<void> {
    if (!this.remotePeerId.trim()) {
      alert('Please enter a peer ID');
      return;
    }

    console.log('🎤 Starting audio call to:', this.remotePeerId);
    this.isCalling = true;
    
    try {
      await this.peerService.startAudioCall(this.remotePeerId);
      this.isInCall = true;
      this.callType = 'audio';
      console.log('✅ Audio call started successfully');
    } catch (error: any) {
      console.error('❌ Failed to start audio call:', error);
      alert(`Failed to start audio call: ${error.message}`);
    } finally {
      this.isCalling = false;
    }
  }

  async answerCall(accept: boolean = true): Promise<void> {
    if (this.incomingCall) {
      console.log('📞 Answering call:', accept ? 'Accept' : 'Decline');
      try {
        await this.peerService.answerCall(this.incomingCall, accept);
        if (accept) {
          this.isInCall = true;
          this.isCallIncoming = false;
          console.log('✅ Call accepted');
        } else {
          this.isCallIncoming = false;
          console.log('❌ Call declined');
        }
      } catch (error: any) {
        console.error('❌ Failed to answer call:', error);
        alert(`Failed to answer call: ${error.message}`);
      } finally {
        this.incomingCall = null;
      }
    }
  }

  endCall(): void {
    console.log('📞 Ending call');
    this.peerService.endCurrentCall();
    this.handleCallEnded();
  }

  private handleCallEnded(): void {
    console.log('📞 Handling call ended');
    this.isInCall = false;
    this.isCallIncoming = false;
    this.incomingCall = null;
    this.remoteStream = null;
    this.callType = null;
    this.isCalling = false;
    this.callEnded.emit();
  }

  toggleVideo(): void {
    this.isVideoEnabled = !this.isVideoEnabled;
    this.peerService.toggleVideo(this.isVideoEnabled);
    console.log('📹 Video', this.isVideoEnabled ? 'enabled' : 'disabled');
  }

  toggleAudio(): void {
    this.isAudioEnabled = !this.isAudioEnabled;
    this.peerService.toggleAudio(this.isAudioEnabled);
    console.log('🎤 Audio', this.isAudioEnabled ? 'enabled' : 'disabled');
  }

  private handleError(error: any): void {
    console.error('❌ Video chat error:', error);
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

  copyPeerId(): void {
    navigator.clipboard.writeText(this.peerId)
      .then(() => {
        alert('Peer ID copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy peer ID:', err);
      });
  }

  private cleanup(): void {
    console.log('🧹 Cleaning up video chat');
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.isInCall) {
      this.endCall();
    }
    
    // Clean up local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }
}
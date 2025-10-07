// In peer.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Peer, MediaConnection } from 'peerjs';
import { HttpClient } from '@angular/common/http';

export interface CallState {
  isInCall: boolean;
  callType: 'video' | 'audio' | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
}

export interface CallMetadata {
  callType: 'video' | 'audio';
  timestamp?: number;
  userId?: string;
}

export interface PeerError {
  type: string;
  message: string;
  originalError: any;
}

@Injectable({
  providedIn: 'root'
})
export class PeerService {
  private peer!: Peer;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentCall: MediaConnection | null = null;
  private callTimeout: any;

  // Subjects - FIXED TYPES
  private callSubject = new BehaviorSubject<MediaConnection | null>(null);
  private streamSubject = new BehaviorSubject<MediaStream | null>(null);
  private callEndedSubject = new Subject<void>();
  private errorSubject = new BehaviorSubject<PeerError | null>(null);
  private stateSubject = new BehaviorSubject<CallState>({
    isInCall: false,
    callType: null,
    remoteStream: null,
    localStream: null
  });
  
  // Public subjects with correct types
  public peerIdSubject = new BehaviorSubject<string>(''); // For peer ID
  public connectionStateSubject = new BehaviorSubject<boolean>(false); // For connection state (true/false)
  public incomingCallSubject = new Subject<MediaConnection>();

  // Configuration
  private readonly peerConfig = {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    debug: 3,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  };

  // State
  isInCall: boolean = false;
  callType: 'video' | 'audio' | null = null;

  constructor(private http: HttpClient) {
    // Don't auto-initialize - wait for user login
  }

  // Initialize peer when user logs in
  async initializeUserForVideoChat(user: any): Promise<string> {
    try {
      const peerId = await this.initializePeerForUser(user.id);
      console.log('User ready for video calls with ID:', peerId);
      
      this.setupIncomingCallListener();
      this.connectionStateSubject.next(true); // Connection established
      this.peerIdSubject.next(peerId); // Emit peer ID
      
      return peerId;
    } catch (error) {
      console.error('Failed to initialize peer connection:', error);
      this.connectionStateSubject.next(false); // Connection failed
      this.peerIdSubject.next(''); // Clear peer ID
      throw error;
    }
  }

  private initializePeerForUser(userId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Destroy existing peer if any
      if (this.peer) {
        this.peer.destroy();
      }

      // Create new peer - use userId as peer ID for consistency
      this.peer = new Peer(userId, this.peerConfig);

      this.peer.on('open', (id: string) => {
        console.log('Peer connection opened with ID:', id);
        
        // Save peerId to user profile in backend
        this.savePeerIdToUser(userId, id).subscribe({
          next: () => {
            console.log('Peer ID saved to user profile:', id);
            this.connectionStateSubject.next(true);
            this.peerIdSubject.next(id);
            resolve(id);
          },
          error: (err) => {
            console.error('Failed to save peer ID:', err);
            // Still resolve with the ID even if save fails
            this.connectionStateSubject.next(true);
            this.peerIdSubject.next(id);
            resolve(id);
          }
        });
      });

      this.peer.on('error', (error) => {
        console.error('Peer connection error:', error);
        this.connectionStateSubject.next(false);
        this.peerIdSubject.next('');
        reject(error);
      });

      this.peer.on('disconnected', () => {
        console.log('Peer disconnected');
        this.connectionStateSubject.next(false);
      });
    });
  }

  private setupIncomingCallListener() {
    this.peer.on('call', (incomingCall: MediaConnection) => {
      console.log('Incoming call from:', incomingCall.peer);
      
      // Show incoming call UI
      this.incomingCallSubject.next(incomingCall);
      this.callSubject.next(incomingCall);
    });
  }

  private savePeerIdToUser(userId: string, peerId: string) {
    return this.http.patch(`/api/users/${userId}/peerId`, { peerId });
  }

  // Start call method
  startCall(targetPeerId: string, localStream: MediaStream): MediaConnection {
    if (!this.peer) {
      throw new Error('Peer not initialized. Call initializeUserForVideoChat first.');
    }
    
    console.log('Starting call to:', targetPeerId);
    const call = this.peer.call(targetPeerId, localStream);
    
    call.on('error', (error: any) => {
      console.error('Call error:', error);
      this.handlePeerError(error);
    });
    
    return call;
  }

  private handlePeerError(error: any): void {
    console.error('PeerJS Error:', error);
    
    const errorMessage = this.mapPeerError(error);
    this.errorSubject.next({
      type: 'peer',
      message: errorMessage,
      originalError: error
    });
  }

  private mapPeerError(error: any): string {
    switch (error.type) {
      case 'peer-unavailable':
        return 'The user you are trying to call is unavailable';
      case 'disconnected':
        return 'Connection lost. Attempting to reconnect...';
      case 'browser-incompatible':
        return 'Your browser does not support WebRTC';
      default:
        return 'An unexpected error occurred';
    }
  }

  // Get peer ID
  getPeerId(): string {
    return this.peer?.id || '';
  }

  // Check if connected
  isConnected(): boolean {
    return this.peer?.open || false;
  }

  // Start video call
  async startVideoCall(remotePeerId: string): Promise<void> {
    console.log('🎥 Starting video call to:', remotePeerId);
    
    try {
      // Get local media stream
      this.localStream = await this.getUserMedia(this.getMediaConstraints('video'));
      
      // Make the call using the startCall method
      this.currentCall = this.startCall(remotePeerId, this.localStream);
      
      if (!this.currentCall) {
        throw new Error('Failed to create call object');
      }

      // Set up call event handlers
      this.setupCallHandlers(this.currentCall);
      
      this.isInCall = true;
      this.callType = 'video';
      this.updateState();
      
      console.log('✅ Video call initiated');

    } catch (error) {
      console.error('❌ Failed to start video call:', error);
      this.handlePeerError(error);
      throw error;
    }
  }

  // Start audio call
  async startAudioCall(remotePeerId: string): Promise<void> {
    console.log('🎤 Starting audio call to:', remotePeerId);
    
    try {
      // Get local media stream (audio only)
      this.localStream = await this.getUserMedia(this.getMediaConstraints('audio'));
      
      // Make the call using the startCall method
      this.currentCall = this.startCall(remotePeerId, this.localStream);
      
      if (!this.currentCall) {
        throw new Error('Failed to create call object');
      }

      // Set up call event handlers
      this.setupCallHandlers(this.currentCall);
      
      this.isInCall = true;
      this.callType = 'audio';
      this.updateState();
      
      console.log('✅ Audio call initiated');

    } catch (error) {
      console.error('❌ Failed to start audio call:', error);
      this.handlePeerError(error);
      throw error;
    }
  }

  private setupCallHandlers(call: MediaConnection): void {
    // Set call timeout (30 seconds)
    this.callTimeout = setTimeout(() => {
      if (!this.remoteStream) {
        console.warn('Call timeout - no stream received');
        this.endCurrentCall();
      }
    }, 30000);

    call.on('stream', (remoteStream: MediaStream) => {
      console.log('📹 Received remote stream');
      clearTimeout(this.callTimeout);
      this.remoteStream = remoteStream;
      this.streamSubject.next(remoteStream);
      this.updateState();
    });

    call.on('close', () => {
      console.log('📞 Call closed');
      clearTimeout(this.callTimeout);
      this.endCurrentCall();
    });

    call.on('error', (error: any) => {
      console.error('❌ Call error:', error);
      clearTimeout(this.callTimeout);
      this.handlePeerError(error);
    });
  }

  // Answer incoming call
  async answerCall(call: MediaConnection | null, accept: boolean = true): Promise<void> {
    if (!call) {
      console.error('❌ Cannot answer null call');
      return;
    }

    if (!accept) {
      call.close();
      return;
    }

    try {
      // Get local media stream based on call type
      const callType = (call.metadata as any)?.callType || 'video';
      this.localStream = await this.getUserMedia({ 
        video: callType === 'video', 
        audio: true 
      });

      // Answer the call with our stream
      call.answer(this.localStream);

      // Set up call handlers
      this.setupCallHandlers(call);
      this.currentCall = call;
      
      this.isInCall = true;
      this.callType = callType;
      this.updateState();
      
      console.log('✅ Call answered');

    } catch (error) {
      console.error('❌ Failed to answer call:', error);
      this.handlePeerError(error);
      throw error;
    }
  }

  // End current call
  endCurrentCall(): void {
    if (this.currentCall) {
      this.currentCall.close();
      this.currentCall = null;
    }
    
    this.cleanupMediaStreams();
    
    this.isInCall = false;
    this.callType = null;
    this.updateState();
    
    this.callEndedSubject.next();
    console.log('📞 Call ended');
  }

  private cleanupMediaStreams(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      this.localStream = null;
    }
    
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => {
        track.enabled = false;
      });
      this.remoteStream = null;
      this.streamSubject.next(null);
    }
  }

  private getMediaConstraints(callType: 'video' | 'audio'): MediaStreamConstraints {
    return {
      video: callType === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      } : false,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };
  }

  // Get user media
  async getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Media stream obtained');
      return stream;
    } catch (error) {
      console.error('❌ Failed to get media stream:', error);
      throw error;
    }
  }

  private updateState(): void {
    this.stateSubject.next({
      isInCall: this.isInCall,
      callType: this.callType,
      remoteStream: this.remoteStream,
      localStream: this.localStream
    });
  }

  // Toggle video
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = enabled;
        console.log('📹 Video', enabled ? 'enabled' : 'disabled');
      }
    }
  }

  // Toggle audio
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
        console.log('🎤 Audio', enabled ? 'enabled' : 'disabled');
      }
    }
  }

  // Observables
  onCall(): Observable<MediaConnection | null> {
    return this.callSubject.asObservable();
  }

  onStream(): Observable<MediaStream | null> {
    return this.streamSubject.asObservable();
  }

  onCallEnded(): Observable<void> {
    return this.callEndedSubject.asObservable();
  }

  onError(): Observable<PeerError | null> {
    return this.errorSubject.asObservable();
  }

  getState(): Observable<CallState> {
    return this.stateSubject.asObservable();
  }

  // New observable methods for the public subjects
  onPeerId(): Observable<string> {
    return this.peerIdSubject.asObservable();
  }

  onConnectionState(): Observable<boolean> {
    return this.connectionStateSubject.asObservable();
  }

  onIncomingCall(): Observable<MediaConnection> {
    return this.incomingCallSubject.asObservable();
  }

  // Destroy peer
  destroy(): void {
    this.endCurrentCall();
    clearTimeout(this.callTimeout);
    if (this.peer && !this.peer.destroyed) {
      this.peer.destroy();
    }
    this.connectionStateSubject.next(false);
    this.peerIdSubject.next('');
  }
}
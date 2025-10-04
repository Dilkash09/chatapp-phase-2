import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Peer, MediaConnection, DataConnection } from 'peerjs';

export interface Call {
  connection: MediaConnection;
  remoteStream: MediaStream | null;
  isIncoming: boolean;
}

export interface VideoCallState {
  isInCall: boolean;
  currentCall: Call | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callType: 'video' | 'audio' | null;
}

@Injectable({
  providedIn: 'root'
})
export class PeerService {
  private peer: Peer | null = null;
  private localStream: MediaStream | null = null;
  private currentCall: MediaConnection | null = null;
  private dataConnections: Map<string, DataConnection> = new Map();

  // Subjects for observable streams
  private callSubject = new Subject<MediaConnection>();
  private callEndedSubject = new Subject<string>();
  private streamSubject = new Subject<MediaStream>();
  private errorSubject = new Subject<any>();
  private peerConnectedSubject = new Subject<string>();
  private stateSubject = new BehaviorSubject<VideoCallState>({
    isInCall: false,
    currentCall: null,
    localStream: null,
    remoteStream: null,
    callType: null
  });

  // Configuration
  private peerConfig = {
    host: window.location.hostname,
    port: window.location.port === '' ? 443 : parseInt(window.location.port),
    path: '/peerjs',
    debug: 3,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  };

  constructor() {
    this.initializePeer();
  }

  /**
   * Initialize the Peer instance
   */
  private initializePeer(): void {
    try {
      // Generate a unique peer ID or use existing one from storage
      const savedPeerId = localStorage.getItem('peerId');
      const peerId = savedPeerId || this.generatePeerId();
      
      this.peer = new Peer(peerId, this.peerConfig);
      
      // Store the peer ID for future use
      if (!savedPeerId) {
        localStorage.setItem('peerId', peerId);
      }

      this.setupPeerEventHandlers();
    } catch (error) {
      console.error('Failed to initialize Peer:', error);
      this.errorSubject.next(error);
    }
  }

  /**
   * Generate a unique peer ID
   */
  private generatePeerId(): string {
    return `user_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  }

  /**
   * Set up event handlers for the Peer instance
   */
  private setupPeerEventHandlers(): void {
    if (!this.peer) return;

    this.peer.on('open', (id: string) => {
      console.log('Peer connected with ID:', id);
      this.peerConnectedSubject.next(id);
    });

    this.peer.on('call', (call: MediaConnection) => {
      console.log('Incoming call from:', call.peer);
      this.callSubject.next(call);
    });

    this.peer.on('connection', (connection: DataConnection) => {
      console.log('Data connection from:', connection.peer);
      this.setupDataConnection(connection);
    });

    this.peer.on('error', (error: any) => {
      console.error('Peer error:', error);
      this.errorSubject.next(error);
    });

    this.peer.on('disconnected', () => {
      console.log('Peer disconnected, attempting reconnect...');
      setTimeout(() => {
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect();
        }
      }, 5000);
    });

    this.peer.on('close', () => {
      console.log('Peer connection closed');
    });
  }

  /**
   * Set up data connection for signaling
   */
  private setupDataConnection(connection: DataConnection): void {
    connection.on('open', () => {
      console.log('Data connection opened with:', connection.peer);
      this.dataConnections.set(connection.peer, connection);
    });

    connection.on('data', (data: any) => {
      this.handleDataMessage(connection.peer, data);
    });

    connection.on('close', () => {
      console.log('Data connection closed with:', connection.peer);
      this.dataConnections.delete(connection.peer);
    });

    connection.on('error', (error: any) => {
      console.error('Data connection error:', error);
    });
  }

  /**
   * Handle incoming data messages
   */
  private handleDataMessage(peerId: string, data: any): void {
    console.log('Received data from', peerId, ':', data);
    
    // Handle different types of data messages
    switch (data.type) {
      case 'call-request':
        this.handleCallRequest(peerId, data);
        break;
      case 'call-accepted':
        this.handleCallAccepted(peerId, data);
        break;
      case 'call-rejected':
        this.handleCallRejected(peerId, data);
        break;
      case 'call-ended':
        this.handleCallEnded(peerId, data);
        break;
      case 'toggle-video':
        this.handleToggleVideo(data.enabled);
        break;
      case 'toggle-audio':
        this.handleToggleAudio(data.enabled);
        break;
      default:
        console.log('Unknown data message type:', data.type);
    }
  }

  /**
   * Get the current peer ID
   */
  getPeerId(): string {
    return this.peer?.id || '';
  }

  /**
   * Check if peer is connected
   */
  isConnected(): boolean {
    return this.peer !== null && !this.peer.destroyed && this.peer.open;
  }

  /**
   * Get user media (camera and microphone)
   */
  async getUserMedia(constraints: MediaStreamConstraints = { video: true, audio: true }): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.updateState({ localStream: this.localStream });
      return this.localStream;
    } catch (error) {
      console.error('Error getting user media:', error);
      this.errorSubject.next(error);
      throw error;
    }
  }

  /**
   * Start a video call with another user
   */
  async startVideoCall(remotePeerId: string): Promise<MediaConnection> {
    if (!this.peer) {
      throw new Error('Peer not initialized');
    }

    if (!this.localStream) {
      await this.getUserMedia();
    }

    try {
      const call = this.peer.call(remotePeerId, this.localStream!);
      this.setupCallHandlers(call, false);
      this.currentCall = call;
      
      this.updateState({
        isInCall: true,
        currentCall: { connection: call, remoteStream: null, isIncoming: false },
        callType: 'video'
      });

      // Send call request via data channel
      this.sendData(remotePeerId, {
        type: 'call-request',
        callType: 'video',
        timestamp: Date.now()
      });

      return call;
    } catch (error) {
      console.error('Error starting call:', error);
      this.errorSubject.next(error);
      throw error;
    }
  }

  /**
   * Start an audio call with another user
   */
  async startAudioCall(remotePeerId: string): Promise<MediaConnection> {
    if (!this.peer) {
      throw new Error('Peer not initialized');
    }

    if (!this.localStream) {
      await this.getUserMedia({ video: false, audio: true });
    }

    try {
      const call = this.peer.call(remotePeerId, this.localStream!);
      this.setupCallHandlers(call, false);
      this.currentCall = call;
      
      this.updateState({
        isInCall: true,
        currentCall: { connection: call, remoteStream: null, isIncoming: false },
        callType: 'audio'
      });

      // Send call request via data channel
      this.sendData(remotePeerId, {
        type: 'call-request',
        callType: 'audio',
        timestamp: Date.now()
      });

      return call;
    } catch (error) {
      console.error('Error starting audio call:', error);
      this.errorSubject.next(error);
      throw error;
    }
  }

  /**
   * Answer an incoming call
   */
  async answerCall(call: MediaConnection, accept: boolean = true): Promise<void> {
    if (!accept) {
      call.close();
      this.sendData(call.peer, {
        type: 'call-rejected',
        timestamp: Date.now()
      });
      return;
    }

    if (!this.localStream) {
      await this.getUserMedia();
    }

    try {
      call.answer(this.localStream!);
      this.setupCallHandlers(call, true);
      this.currentCall = call;
      
      this.updateState({
        isInCall: true,
        currentCall: { connection: call, remoteStream: null, isIncoming: true },
        callType: call.metadata?.callType || 'video'
      });

      // Send call accepted message
      this.sendData(call.peer, {
        type: 'call-accepted',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error answering call:', error);
      this.errorSubject.next(error);
      throw error;
    }
  }

  /**
   * Set up event handlers for a call
   */
  private setupCallHandlers(call: MediaConnection, isIncoming: boolean): void {
    call.on('stream', (remoteStream: MediaStream) => {
      console.log('Received remote stream');
      this.updateState({ remoteStream });
      this.streamSubject.next(remoteStream);
    });

    call.on('close', () => {
      console.log('Call ended');
      this.cleanupCall();
      this.callEndedSubject.next(call.peer);
    });

    call.on('error', (error: any) => {
      console.error('Call error:', error);
      this.errorSubject.next(error);
      this.cleanupCall();
    });
  }

  /**
   * End the current call
   */
  endCurrentCall(): void {
    if (this.currentCall) {
      this.sendData(this.currentCall.peer, {
        type: 'call-ended',
        timestamp: Date.now()
      });
      this.currentCall.close();
      this.cleanupCall();
    }
  }

  /**
   * Clean up call resources
   */
  private cleanupCall(): void {
    this.currentCall = null;
    this.updateState({
      isInCall: false,
      currentCall: null,
      remoteStream: null,
      callType: null
    });
  }

  /**
   * Toggle local video stream
   */
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = enabled;
      });

      if (this.currentCall) {
        this.sendData(this.currentCall.peer, {
          type: 'toggle-video',
          enabled: enabled,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Toggle local audio stream
   */
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = enabled;
      });

      if (this.currentCall) {
        this.sendData(this.currentCall.peer, {
          type: 'toggle-audio',
          enabled: enabled,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Handle toggle video from remote
   */
  private handleToggleVideo(enabled: boolean): void {
    // This can be used to update UI showing remote video state
    console.log('Remote video', enabled ? 'enabled' : 'disabled');
  }

  /**
   * Handle toggle audio from remote
   */
  private handleToggleAudio(enabled: boolean): void {
    // This can be used to update UI showing remote audio state
    console.log('Remote audio', enabled ? 'enabled' : 'disabled');
  }

  /**
   * Handle call request
   */
  private handleCallRequest(peerId: string, data: any): void {
    // This will trigger the call Subject that components can subscribe to
    console.log('Call request from:', peerId, 'type:', data.callType);
  }

  /**
   * Handle call accepted
   */
  private handleCallAccepted(peerId: string, data: any): void {
    console.log('Call accepted by:', peerId);
  }

  /**
   * Handle call rejected
   */
  private handleCallRejected(peerId: string, data: any): void {
    console.log('Call rejected by:', peerId);
    this.cleanupCall();
  }

  /**
   * Handle call ended by remote
   */
  private handleCallEnded(peerId: string, data: any): void {
    console.log('Call ended by remote:', peerId);
    this.cleanupCall();
  }

  /**
   * Send data to a peer
   */
  sendData(peerId: string, data: any): void {
    let connection = this.dataConnections.get(peerId);
    
    if (!connection) {
      // Create new data connection
      if (this.peer) {
        connection = this.peer.connect(peerId);
        this.setupDataConnection(connection);
      }
    }

    if (connection && connection.open) {
      connection.send(data);
    } else {
      console.warn('Data connection not open for peer:', peerId);
    }
  }

  /**
   * Update state and notify subscribers
   */
  private updateState(updates: Partial<VideoCallState>): void {
    const currentState = this.stateSubject.value;
    this.stateSubject.next({ ...currentState, ...updates });
  }

  /**
   * Get local media stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Stop local media stream
   */
  stopLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
      this.updateState({ localStream: null });
    }
  }

  /**
   * Destroy peer and cleanup resources
   */
  destroy(): void {
    this.endCurrentCall();
    this.stopLocalStream();
    
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.dataConnections.clear();
  }

  // Observable getters
  onCall(): Observable<MediaConnection> {
    return this.callSubject.asObservable();
  }

  onCallEnded(): Observable<string> {
    return this.callEndedSubject.asObservable();
  }

  onStream(): Observable<MediaStream> {
    return this.streamSubject.asObservable();
  }

  onError(): Observable<any> {
    return this.errorSubject.asObservable();
  }

  onPeerConnected(): Observable<string> {
    return this.peerConnectedSubject.asObservable();
  }

  getState(): Observable<VideoCallState> {
    return this.stateSubject.asObservable();
  }

  getCurrentState(): VideoCallState {
    return this.stateSubject.value;
  }
}
// services/image-upload.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface UploadResponse {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  dimensions?: { width: number; height: number };
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ImageUploadService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // Get auth headers
  private getAuthHeaders(): HttpHeaders {
    // const token = this.authService.getAuthHeaders();
     let token = '';
    
    // Only access localStorage in browser environment
  
      token = localStorage.getItem('token') || '';
    
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  // Upload profile image
  uploadProfileImage(file: File, userId: string): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('profileImage', file);
    formData.append('userId', userId);

    return this.http.post<UploadResponse>(
      `${this.baseUrl}/upload/profile`, 
      formData,
      { headers: this.getAuthHeaders() }
    );
  }

  // Upload message image
  uploadMessageImage(file: File, channelId: string, userId: string): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('messageImage', file);
    formData.append('channelId', channelId);
    formData.append('userId', userId);

    return this.http.post<UploadResponse>(
      `${this.baseUrl}/upload/message`, 
      formData,
      { headers: this.getAuthHeaders() }
    );
  }

  // Validate image file
  validateImageFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Only JPEG, PNG, GIF, and WebP images are allowed' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'Image size must be less than 5MB' };
    }

    return { valid: true };
  }

  // Get image dimensions
  getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(url);
      };
      
      img.onerror = () => {
        resolve({ width: 0, height: 0 });
        URL.revokeObjectURL(url);
      };
      
      img.src = url;
    });
  }
}
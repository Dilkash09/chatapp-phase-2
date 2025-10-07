import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { PeerService } from '../../services/peer.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private peerService = inject(PeerService);

  username = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  async login() {
    if (!this.username || !this.password) {
      this.errorMessage = 'Please enter both username and password';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      // Login and get user data
      const user = await this.authService.login(this.username, this.password).toPromise();
      
      // Initialize peer service for video chat
      if (user) {
        await this.peerService.initializeUserForVideoChat(user);
        console.log('Video chat initialized for user:', user.username);
      }
      
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      this.errorMessage = error.error?.error || 'Login failed';
      console.error('Login error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  navigateToRegister() {
    this.router.navigate(['/register']);
  }
}
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {

 constructor() {
    console.log('RegisterComponent constructor called!'); // 👈 Check for this message
    
  }

public  testClick() {
  alert('Button clicked!');
}
  private authService = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';
  email = '';
  isLoading = false;
  errorMessage = '';




  register() {
    console.log('Register button clicked!'); // 👈 Add this line for debugging

    if (!this.username || !this.password || !this.email) {
      this.errorMessage = 'Please fill all fields';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.register(this.username, this.password, this.email)
      .subscribe({
        next: () => {
          this.isLoading = false;
          alert('Registration successful. Please login.');
          this.router.navigate(['/login']);
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.error?.error || 'Registration failed';
          console.error('Registration error:', error);
        }
      });
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}
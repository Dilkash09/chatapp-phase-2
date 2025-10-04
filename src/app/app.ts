import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

@Component({
selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet,
    HttpClientModule,
  ],
  template: `<router-outlet></router-outlet>`,
  styles: [`
    :host {
      display: block;
      height: 100vh;
    }
  `]
})
export class App {
  protected readonly title = signal('chat');
}

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoChat } from './video-chat';

describe('VideoChat', () => {
  let component: VideoChat;
  let fixture: ComponentFixture<VideoChat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoChat]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VideoChat);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

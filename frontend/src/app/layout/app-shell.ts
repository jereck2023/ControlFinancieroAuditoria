import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Session } from '../core/auth/session';
import { AccessPolicy } from '../core/auth/access-policy';
import { ROLE_LABELS } from '../core/auth/roles';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, DatePipe],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  protected readonly session = inject(Session);
  protected readonly policy = inject(AccessPolicy);
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly menuOpen = signal(false);
}

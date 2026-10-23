import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AdminConversation, CustomerStats } from '../messages.component';

@Component({
  selector: 'app-customer-profile',
  standalone: false,
  templateUrl: './customer-profile.component.html',
  styleUrls: ['./customer-profile.component.css']
})
export class CustomerProfileComponent {
  @Input() selectedConversation: AdminConversation | null = null;
  @Input() customerStats: CustomerStats | null = null;
  @Input() internalNoteText: string = '';
  @Input() isSavingNote: boolean = false;
  @Input() noteSavedSuccess: boolean = false;
  @Input() showCustomerInfoDrawer: boolean = false;

  @Output() noteTextChanged = new EventEmitter<string>();
  @Output() saveNoteRequested = new EventEmitter<void>();
  @Output() closeProfileRequested = new EventEmitter<void>();

  onNoteInput(val: string): void {
    this.noteTextChanged.emit(val);
  }

  onSaveNote(): void {
    this.saveNoteRequested.emit();
  }

  onCloseProfile(): void {
    this.closeProfileRequested.emit();
  }

  getCustomerDisplayName(conv: AdminConversation | null): string {
    if (!conv) return '';
    if (conv.userId) {
      return conv.userId.fullName || conv.userId.name || conv.userId.email || 'Khách hàng';
    }
    if (conv.guestId) {
      return 'Khách vãng lai (' + conv.guestId.substring(0, 8) + ')';
    }
    return 'Khách hàng';
  }

  getCustomerAvatar(conv: AdminConversation | null): string | null {
    if (!conv || !conv.userId) return null;
    return conv.userId.avatar || null;
  }
}

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AdminConversation } from '../messages.component';

@Component({
  selector: 'app-conversation-list',
  standalone: false,
  templateUrl: './conversation-list.component.html',
  styleUrls: ['./conversation-list.component.css']
})
export class ConversationListComponent {
  @Input() conversations: AdminConversation[] = [];
  @Input() selectedConversation: AdminConversation | null = null;
  @Input() counts = {
    waiting: 0,
    inProgress: 0,
    unread: 0,
    total: 0,
  };
  @Input() activeFilter: string = 'all';
  @Input() searchTerm: string = '';
  @Input() isLoadingConversations: boolean = false;
  @Input() currentAdminId: string | null = null;

  @Output() conversationSelected = new EventEmitter<AdminConversation>();
  @Output() filterChanged = new EventEmitter<string>();
  @Output() searchChanged = new EventEmitter<string>();
  @Output() searchSubmitted = new EventEmitter<void>();

  onSelectConversation(conv: AdminConversation): void {
    this.conversationSelected.emit(conv);
  }

  onSetFilter(filter: string): void {
    this.filterChanged.emit(filter);
  }

  onSearchInput(val: string): void {
    this.searchChanged.emit(val);
  }

  onSearchSubmit(): void {
    this.searchSubmitted.emit();
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

  getStatusBadgeClass(status?: string): string {
    switch (status) {
      case 'WAITING_ADMIN':
        return 'badge-warning';
      case 'IN_PROGRESS':
        return 'badge-primary';
      case 'REPLIED':
        return 'badge-success';
      case 'CLOSED':
        return 'badge-neutral';
      default:
        return 'badge-neutral';
    }
  }

  getStatusLabel(status?: string): string {
    switch (status) {
      case 'WAITING_ADMIN':
        return 'Chờ nhân viên';
      case 'IN_PROGRESS':
        return 'Đang hỗ trợ';
      case 'REPLIED':
        return 'Đã phản hồi';
      case 'CLOSED':
        return 'Đã đóng';
      default:
        return status || '';
    }
  }

  isAssignedToMe(conv: AdminConversation): boolean {
    if (!conv || !conv.assignedAdminId || !this.currentAdminId) return false;
    const assignedId = typeof conv.assignedAdminId === 'string'
      ? conv.assignedAdminId
      : (conv.assignedAdminId?._id || conv.assignedAdminId?.id);
    if (!assignedId) return false;
    return String(assignedId).trim().toLowerCase() === String(this.currentAdminId).trim().toLowerCase();
  }

  getAssignedAdminName(conv: AdminConversation): string {
    if (!conv || !conv.assignedAdminId) return '';
    if (typeof conv.assignedAdminId === 'object') {
      return conv.assignedAdminId.fullName || conv.assignedAdminId.name || 'Nhân viên';
    }
    return 'Nhân viên';
  }

  getAssignmentBadgeClass(conv: AdminConversation): string {
    if (conv.status === 'CLOSED') {
      return conv.assignedAdminId ? 'assign-closed' : 'assign-closed-none';
    }
    if (conv.status === 'WAITING_ADMIN') return 'assign-waiting';
    if (this.isAssignedToMe(conv)) return 'assign-me';
    if (conv.assignedAdminId) return 'assign-other';
    return 'assign-waiting';
  }

  getAssignmentLabel(conv: AdminConversation): string {
    if (conv.status === 'CLOSED') {
      return conv.assignedAdminId ? this.getAssignedAdminName(conv) : 'Đã kết thúc';
    }
    if (conv.status === 'WAITING_ADMIN') return 'Chưa phân công';
    if (this.isAssignedToMe(conv)) return 'Bạn phụ trách';
    if (conv.assignedAdminId) return this.getAssignedAdminName(conv);
    return 'Chưa phân công';
  }
}

import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewChecked, OnChanges, SimpleChanges } from '@angular/core';
import { AdminConversation, AdminMessage } from '../messages.component';

@Component({
  selector: 'app-chat-panel',
  standalone: false,
  templateUrl: './chat-panel.component.html',
  styleUrls: ['./chat-panel.component.css']
})
export class ChatPanelComponent implements AfterViewChecked, OnChanges {
  @ViewChild('messagesScroll') private messagesScrollContainer!: ElementRef;

  @Input() selectedConversation: AdminConversation | null = null;
  @Input() messages: AdminMessage[] = [];
  @Input() newMessageText: string = '';
  @Input() isLoadingMessages: boolean = false;
  @Input() isSendingMessage: boolean = false;
  @Input() isAccepting: boolean = false;
  @Input() isReturning: boolean = false;
  @Input() isClosing: boolean = false;
  @Input() currentAdminId: string | null = null;
  @Input() isSuperAdmin: boolean = false;
  @Input() showCustomerInfoDrawer: boolean = false;

  @Output() messageTextChanged = new EventEmitter<string>();
  @Output() sendMessageRequested = new EventEmitter<void>();
  @Output() acceptRequested = new EventEmitter<void>();
  @Output() returnRequested = new EventEmitter<void>();
  @Output() closeRequested = new EventEmitter<void>();
  @Output() backRequested = new EventEmitter<void>();
  @Output() profileToggleRequested = new EventEmitter<void>();

  private shouldScrollBottom: boolean = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['messages'] || changes['selectedConversation']) {
      this.shouldScrollBottom = true;
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollBottom) {
      this.scrollToBottom();
      this.shouldScrollBottom = false;
    }
  }

  public scrollToBottom(): void {
    try {
      if (this.messagesScrollContainer) {
        this.messagesScrollContainer.nativeElement.scrollTop =
          this.messagesScrollContainer.nativeElement.scrollHeight;
      }
    } catch (_) {}
  }

  onInputText(val: string): void {
    this.messageTextChanged.emit(val);
  }

  onSendMessage(): void {
    this.sendMessageRequested.emit();
  }

  onAccept(): void {
    this.acceptRequested.emit();
  }

  onReturn(): void {
    this.returnRequested.emit();
  }

  onClose(): void {
    this.closeRequested.emit();
  }

  onBack(): void {
    this.backRequested.emit();
  }

  onToggleProfile(): void {
    this.profileToggleRequested.emit();
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

  isAssignedToMe(conv: AdminConversation | null): boolean {
    if (!conv || !conv.assignedAdminId || !this.currentAdminId) return false;
    const assignedId = typeof conv.assignedAdminId === 'string'
      ? conv.assignedAdminId
      : (conv.assignedAdminId?._id || conv.assignedAdminId?.id);
    if (!assignedId) return false;
    return String(assignedId).trim().toLowerCase() === String(this.currentAdminId).trim().toLowerCase();
  }

  getAssignedAdminName(conv: AdminConversation | null): string {
    if (!conv || !conv.assignedAdminId) return '';
    if (typeof conv.assignedAdminId === 'object' && conv.assignedAdminId !== null) {
      return conv.assignedAdminId.fullName || conv.assignedAdminId.name || 'Nhân viên';
    }
    return 'Nhân viên';
  }

  canManage(conv: AdminConversation | null): boolean {
    if (!conv) return false;
    if (!conv.assignedAdminId) return false;
    return this.isAssignedToMe(conv) || this.isSuperAdmin;
  }

  canSendMessage(conv: AdminConversation | null): boolean {
    if (!conv) return false;
    if (conv.status === 'CLOSED') return false;
    if (conv.status === 'WAITING_ADMIN') return false;
    if (!conv.assignedAdminId) return false;
    return this.canManage(conv);
  }

  getInputPlaceholder(conv: AdminConversation | null): string {
    if (!conv) return 'Chọn cuộc trò chuyện để gửi tin nhắn...';
    if (conv.status === 'CLOSED') return 'Phiên hỗ trợ đã đóng. Khách hàng đang ở chế độ AI.';
    if (conv.status === 'WAITING_ADMIN' || !conv.assignedAdminId) {
      return 'Cuộc hội thoại chưa có người phụ trách. Nhấn "Tiếp nhận" để bắt đầu tư vấn...';
    }
    if (!this.canManage(conv)) {
      const adminName = this.getAssignedAdminName(conv) || 'nhân viên khác';
      return `Cuộc hội thoại đang do ${adminName} phụ trách (Chỉ xem)`;
    }
    return 'Nhập nội dung tư vấn gửi khách hàng... (Enter để gửi)';
  }

  getAssignmentBadgeClass(conv: AdminConversation | null): string {
    if (!conv) return '';
    if (conv.status === 'CLOSED') {
      return conv.assignedAdminId ? 'badge-assign-closed' : 'badge-assign-closed-none';
    }
    if (conv.status === 'WAITING_ADMIN') return 'badge-assign-waiting';
    if (this.isAssignedToMe(conv)) return 'badge-assign-me';
    if (conv.assignedAdminId) return 'badge-assign-other';
    return 'badge-assign-waiting';
  }

  getAssignmentLabel(conv: AdminConversation | null): string {
    if (!conv) return '';
    if (conv.status === 'CLOSED') {
      return conv.assignedAdminId ? ('Đã hỗ trợ: ' + this.getAssignedAdminName(conv)) : 'Đã đóng';
    }
    if (conv.status === 'WAITING_ADMIN') return 'Chưa có nhân viên tiếp nhận';
    if (this.isAssignedToMe(conv)) return 'Đang hỗ trợ bởi bạn';
    if (conv.assignedAdminId) return 'Đang hỗ trợ bởi ' + this.getAssignedAdminName(conv);
    return 'Chưa phân công nhân viên';
  }
}

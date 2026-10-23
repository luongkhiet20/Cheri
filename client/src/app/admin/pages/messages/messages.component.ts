import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { AdminService } from '../../services/admin.service';

export interface AdminConversation {
  _id: string;
  source: string;
  status: 'WAITING_ADMIN' | 'IN_PROGRESS' | 'REPLIED' | 'CLOSED';
  userId?: {
    _id: string;
    fullName?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
    avatar?: string;
    createdAt?: string;
  } | null;
  guestId?: string | null;
  assignedAdminId?: {
    _id?: string;
    id?: string;
    fullName?: string;
    name?: string;
    avatar?: string;
  } | string | null;
  lastMessagePreview?: string;
  lastMessageAt?: string | Date;
  unreadAdminCount?: number;
  unreadCustomerCount?: number;
  internalNote?: string;
  requestedAt?: string | Date;
  acceptedAt?: string | Date;
  closedAt?: string | Date;
  cancelRequest?: {
    requestedAt?: string | Date;
    expiresAt?: string | Date;
    status?: 'PENDING' | 'UNDONE' | 'COMPLETED';
  } | null;
  createdAt?: string | Date;
}

export interface AdminMessage {
  _id: string;
  conversationId: string;
  senderType: 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
  senderId?: any;
  messageType: 'TEXT' | 'IMAGE' | 'PRODUCT_CARD' | 'SYSTEM';
  content: string;
  createdAt: string | Date;
}

export interface CustomerStats {
  orderCount: number;
  totalSpent: number;
  recentOrders: any[];
}

export interface ConversationActionDialogConfig {
  type: 'accept' | 'return' | 'close';
  conversationId: string;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'default' | 'warning' | 'danger';
  iconType: 'accept' | 'return' | 'close';
}

export interface ConversationActionDialogState {
  isOpen: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  config: ConversationActionDialogConfig | null;
}

import { ChatPanelComponent } from './chat-panel/chat-panel.component';

@Component({
  selector: 'app-messages',
  standalone: false,
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css']
})
export class MessagesComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild(ChatPanelComponent) private chatPanelComponent?: ChatPanelComponent;

  // Conversations list & filter
  conversations: AdminConversation[] = [];
  selectedConversation: AdminConversation | null = null;
  selectedConversationDetail: any = null;
  customerStats: CustomerStats | null = null;
  currentAdminUser: any = null;

  messages: AdminMessage[] = [];
  newMessageText: string = '';
  internalNoteText: string = '';

  activeFilter: string = 'all'; // 'all' | 'unread' | 'WAITING_ADMIN' | 'IN_PROGRESS' | 'REPLIED' | 'CLOSED'
  searchTerm: string = '';

  isLoadingConversations: boolean = false;
  isLoadingMessages: boolean = false;
  isSendingMessage: boolean = false;
  isAccepting: boolean = false;
  isReturning: boolean = false;
  isClosing: boolean = false;
  isSavingNote: boolean = false;
  noteSavedSuccess: boolean = false;

  counts = {
    waiting: 0,
    inProgress: 0,
    unread: 0,
    total: 0,
  };

  actionDialog: ConversationActionDialogState = {
    isOpen: false,
    isLoading: false,
    errorMessage: null,
    config: null
  };

  private pollInterval: any = null;
  private shouldScrollBottom: boolean = false;

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initCurrentUser();
    this.loadConversations(true);
    // Auto-refresh every 3.5s to keep active chat near real-time
    this.pollInterval = setInterval(() => {
      this.refreshDataSilently();
    }, 3500);
  }

  getCurrentAdminId(): string | null {
    if (this.currentAdminUser?._id) return String(this.currentAdminUser._id).trim();
    if (this.currentAdminUser?.id) return String(this.currentAdminUser.id).trim();
    const tokenUser = this.getAdminFromToken();
    if (tokenUser?._id) return String(tokenUser._id).trim();
    if (tokenUser?.id) return String(tokenUser.id).trim();
    return null;
  }

  isSuperAdmin(): boolean {
    const roles = this.currentAdminUser?.roles || (this.currentAdminUser?.role ? [this.currentAdminUser.role] : []);
    const tokenRoles = this.getAdminFromToken()?.roles || [];
    const allRoles = [...(Array.isArray(roles) ? roles : []), ...(Array.isArray(tokenRoles) ? tokenRoles : [])];
    return allRoles.some((r: any) => typeof r === 'string' && r.toLowerCase() === 'super-admin');
  }

  private getAdminFromToken(): any {
    try {
      if (typeof window === 'undefined') return null;
      const token = localStorage.getItem('accessToken');
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(payloadBase64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const parsed = JSON.parse(jsonPayload);
      return {
        _id: parsed.id || parsed._id,
        id: parsed.id || parsed._id,
        email: parsed.email,
        roles: parsed.roles || [],
      };
    } catch (_) {
      return null;
    }
  }

  private initCurrentUser(): void {
    // 1. Lấy ngay lập tức từ JWT token (đồng bộ 0ms) để không bị null
    const fromToken = this.getAdminFromToken();
    if (fromToken) {
      this.currentAdminUser = { ...fromToken };
    }

    // 2. Subscribe to reactive currentUser$
    this.adminService.currentUser$.subscribe((u) => {
      if (u) {
        this.currentAdminUser = { ...this.currentAdminUser, ...u };
        this.cdr.markForCheck();
      }
    });

    // 3. Fallback to localStorage
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
          const parsed = JSON.parse(stored);
          this.currentAdminUser = { ...this.currentAdminUser, ...parsed };
        }
      }
    } catch (_) {}

    // 4. Luôn gọi getAccountProfile để lấy đủ fullName, avatar và roles
    this.adminService.getAccountProfile().subscribe({
      next: (res: any) => {
        if (res?.success && res.data) {
          this.currentAdminUser = { ...this.currentAdminUser, ...res.data };
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollBottom) {
      this.scrollToBottom();
      this.shouldScrollBottom = false;
    }
  }

  setFilter(filter: string): void {
    this.activeFilter = filter;
    this.loadConversations(true);
  }

  onSearch(): void {
    this.loadConversations(true);
  }

  loadConversations(showLoading: boolean = false): void {
    if (showLoading) this.isLoadingConversations = true;

    this.adminService.getConversations({
      status: this.activeFilter === 'all' ? undefined : this.activeFilter,
      search: this.searchTerm ? this.searchTerm.trim() : undefined,
      limit: 50,
    }).subscribe({
      next: (res: any) => {
        this.isLoadingConversations = false;
        if (res && res.success && Array.isArray(res.data)) {
          this.conversations = res.data;
          if (res.meta?.counts) {
            this.counts = {
              waiting: res.meta.counts.waiting || 0,
              inProgress: res.meta.counts.inProgress || 0,
              unread: res.meta.counts.unread || 0,
              total: res.meta.counts.all ?? res.meta.total ?? 0,
            };
          }

          // If no conversation selected, select the first one automatically
          if (!this.selectedConversation && this.conversations.length > 0) {
            this.selectConversation(this.conversations[0]);
          } else if (this.selectedConversation) {
            // Keep selected conversation updated immutably
            const updated = this.conversations.find((c) => c._id === this.selectedConversation?._id);
            if (updated) {
              const isWaiting = updated.status === 'WAITING_ADMIN';
              const resolvedAssignedAdmin = isWaiting
                ? null
                : (updated.assignedAdminId !== undefined && updated.assignedAdminId !== null
                    ? updated.assignedAdminId
                    : this.selectedConversation.assignedAdminId);

              this.selectedConversation = {
                ...this.selectedConversation,
                ...updated,
                assignedAdminId: resolvedAssignedAdmin,
              };
            }
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoadingConversations = false;
        console.error('Error loading conversations:', err);
        this.cdr.markForCheck();
      }
    });
  }

  // Responsive navigation state
  mobileView: 'list' | 'chat' = 'list';
  showCustomerInfoDrawer: boolean = false;

  selectConversation(conv: AdminConversation): void {
    this.selectedConversation = conv;
    this.internalNoteText = conv.internalNote || '';
    this.loadConversationDetail(conv._id);
    this.loadMessages(conv._id, true);
    this.mobileView = 'chat';
  }

  backToConversationsList(): void {
    this.mobileView = 'list';
    this.showCustomerInfoDrawer = false;
  }

  toggleCustomerInfo(): void {
    this.showCustomerInfoDrawer = !this.showCustomerInfoDrawer;
  }

  closeCustomerInfo(): void {
    this.showCustomerInfoDrawer = false;
  }

  loadConversationDetail(id: string): void {
    this.adminService.getConversationDetail(id).subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.selectedConversationDetail = res.conversation;
          this.customerStats = res.customerStats || null;
          this.internalNoteText = res.conversation?.internalNote || '';
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('Error loading conversation detail:', err);
        this.cdr.markForCheck();
      }
    });
  }

  loadMessages(id: string, initialLoad: boolean = false): void {
    if (initialLoad) {
      this.isLoadingMessages = true;
    }

    this.adminService.getConversationMessages(id).subscribe({
      next: (res: any) => {
        this.isLoadingMessages = false;
        if (res && res.success && Array.isArray(res.messages)) {
          const prevCount = this.messages.length;
          this.messages = res.messages;
          if (initialLoad || this.messages.length > prevCount) {
            this.shouldScrollBottom = true;
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoadingMessages = false;
        console.error('Error loading messages:', err);
        this.cdr.markForCheck();
      }
    });
  }

  refreshDataSilently(): void {
    // Không refresh ngầm khi popup hành động đang gọi API xử lý
    if (this.actionDialog.isLoading) {
      return;
    }

    if (!this.selectedConversation) {
      this.loadConversations(false);
      return;
    }

    // Refresh conversation list counts
    this.loadConversations(false);

    // Refresh active message thread
    this.adminService.getConversationMessages(this.selectedConversation._id).subscribe({
      next: (res: any) => {
        if (res && res.success && Array.isArray(res.messages)) {
          const hasLengthChanged = res.messages.length !== this.messages.length;
          const hasLastMessageChanged =
            res.messages.length > 0 &&
            this.messages.length > 0 &&
            res.messages[res.messages.length - 1]?._id !== this.messages[this.messages.length - 1]?._id;

          if (hasLengthChanged || hasLastMessageChanged) {
            this.messages = res.messages;
            this.shouldScrollBottom = true;
            this.cdr.markForCheck();
          }
        }
      }
    });
  }

  sendMessage(): void {
    const text = this.newMessageText.trim();
    if (!text || !this.selectedConversation || this.isSendingMessage) return;

    const convId = this.selectedConversation._id;
    const clientMessageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    this.isSendingMessage = true;
    this.cdr.markForCheck();

    this.adminService.sendConversationMessage(convId, text, clientMessageId).subscribe({
      next: (res: any) => {
        this.isSendingMessage = false;
        this.newMessageText = '';
        if (res && res.success && res.message) {
          // Immutable message list update
          this.messages = [...this.messages, res.message];
          this.shouldScrollBottom = true;
          if (this.selectedConversation && this.selectedConversation._id === convId) {
            this.selectedConversation = {
              ...this.selectedConversation,
              status: 'REPLIED',
              lastMessagePreview: text,
              lastMessageAt: new Date().toISOString()
            };
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSendingMessage = false;
        this.cdr.markForCheck();
        // Giữ nguyên text để không làm mất tin nhắn người dùng gõ
        if (err?.status === 403 || err?.status === 409) {
          this.loadConversations(false);
          this.loadConversationDetail(convId);
        }
        alert(err?.error?.message || 'Không thể gửi tin nhắn.');
      }
    });
  }

  acceptConversation(): void {
    if (!this.selectedConversation || this.isAccepting || this.actionDialog.isLoading || this.actionDialog.isOpen) return;

    // Chỉ cho phép tiếp nhận khi hội thoại chưa có admin phụ trách
    const hasAssigned = !!this.selectedConversation.assignedAdminId;
    if (hasAssigned && this.selectedConversation.status !== 'WAITING_ADMIN') {
      return;
    }

    this.actionDialog = {
      isOpen: true,
      isLoading: false,
      errorMessage: null,
      config: {
        type: 'accept',
        conversationId: this.selectedConversation._id,
        title: 'Tiếp nhận cuộc hội thoại',
        message: 'Bạn có chắc chắn muốn tiếp nhận cuộc hội thoại này? Sau khi tiếp nhận, bạn sẽ trở thành nhân viên phụ trách và có thể trực tiếp trả lời khách hàng.',
        confirmLabel: 'Tiếp nhận',
        cancelLabel: 'Hủy',
        variant: 'default',
        iconType: 'accept'
      }
    };
    this.cdr.markForCheck();
  }

  returnConversation(): void {
    if (!this.selectedConversation || this.isReturning || this.actionDialog.isLoading || this.actionDialog.isOpen) return;

    this.actionDialog = {
      isOpen: true,
      isLoading: false,
      errorMessage: null,
      config: {
        type: 'return',
        conversationId: this.selectedConversation._id,
        title: 'Trả cuộc hội thoại',
        message: 'Bạn có chắc chắn muốn trả cuộc hội thoại này về hàng chờ? Sau khi trả, bạn sẽ không còn quyền trả lời và nhân viên khác có thể tiếp nhận để tiếp tục hỗ trợ khách hàng.',
        confirmLabel: 'Trả hội thoại',
        cancelLabel: 'Hủy',
        variant: 'warning',
        iconType: 'return'
      }
    };
    this.cdr.markForCheck();
  }

  closeConversation(): void {
    if (!this.selectedConversation || this.isClosing || this.actionDialog.isLoading || this.actionDialog.isOpen) return;

    this.actionDialog = {
      isOpen: true,
      isLoading: false,
      errorMessage: null,
      config: {
        type: 'close',
        conversationId: this.selectedConversation._id,
        title: 'Kết thúc phiên hỗ trợ',
        message: 'Bạn có chắc chắn muốn kết thúc phiên hỗ trợ này? Khách hàng sẽ quay lại chế độ AI bình thường và phiên hỗ trợ trực tiếp sẽ được đóng.',
        confirmLabel: 'Kết thúc phiên',
        cancelLabel: 'Hủy',
        variant: 'danger',
        iconType: 'close'
      }
    };
    this.cdr.markForCheck();
  }

  handleActionDialogCancel(): void {
    if (this.actionDialog.isLoading) return;
    this.actionDialog = {
      isOpen: false,
      isLoading: false,
      errorMessage: null,
      config: null
    };
    this.cdr.markForCheck();
  }

  handleActionDialogConfirm(): void {
    if (this.actionDialog.isLoading || !this.actionDialog.config) return;

    const { type, conversationId } = this.actionDialog.config;
    if (!conversationId) return;

    this.actionDialog.isLoading = true;
    this.actionDialog.errorMessage = null;
    this.cdr.markForCheck();

    switch (type) {
      case 'accept':
        this.executeAccept(conversationId);
        break;
      case 'return':
        this.executeReturn(conversationId);
        break;
      case 'close':
        this.executeClose(conversationId);
        break;
    }
  }

  private executeAccept(convId: string): void {
    this.isAccepting = true;
    this.cdr.markForCheck();

    this.adminService.acceptConversation(convId).subscribe({
      next: (res: any) => {
        this.isAccepting = false;
        this.actionDialog = {
          isOpen: false,
          isLoading: false,
          errorMessage: null,
          config: null
        };

        if (res && res.success) {
          const currentAdminObj = {
            _id: this.getCurrentAdminId(),
            fullName: this.currentAdminUser?.fullName || this.currentAdminUser?.name || 'Bạn',
            avatar: this.currentAdminUser?.avatar,
          };
          const resolvedAdmin = res.conversation?.assignedAdminId || currentAdminObj;

          if (this.selectedConversation && this.selectedConversation._id === convId) {
            this.selectedConversation = {
              ...this.selectedConversation,
              status: 'IN_PROGRESS',
              assignedAdminId: resolvedAdmin,
              acceptedAt: new Date().toISOString()
            };
          }

          // Cập nhật mảng hội thoại cục bộ ngay lập tức
          this.conversations = this.conversations.map((c) => {
            if (c._id === convId) {
              return {
                ...c,
                status: 'IN_PROGRESS',
                assignedAdminId: resolvedAdmin,
                acceptedAt: new Date().toISOString(),
              };
            }
            return c;
          });

          // Cập nhật số đếm cục bộ ngay lập tức
          if (this.counts.waiting > 0) this.counts.waiting--;
          this.counts.inProgress++;

          // Nếu đang ở tab "Chờ nhân viên", đổi sang tab "all" để hội thoại không biến mất
          if (this.activeFilter === 'WAITING_ADMIN') {
            this.activeFilter = 'all';
          }

          this.loadMessages(convId);
          this.loadConversations(false);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isAccepting = false;
        this.actionDialog.isLoading = false;
        this.actionDialog.errorMessage = err?.error?.message || 'Lỗi khi tiếp nhận hỗ trợ. Vui lòng thử lại.';
        this.cdr.markForCheck();
        if (err?.status === 400 || err?.status === 403 || err?.status === 409) {
          this.loadConversations(false);
          this.loadConversationDetail(convId);
        }
      }
    });
  }

  private executeReturn(convId: string): void {
    this.isReturning = true;
    this.cdr.markForCheck();

    this.adminService.returnConversation(convId).subscribe({
      next: (res: any) => {
        this.isReturning = false;
        this.actionDialog = {
          isOpen: false,
          isLoading: false,
          errorMessage: null,
          config: null
        };

        if (res && res.success) {
          if (this.selectedConversation && this.selectedConversation._id === convId) {
            this.selectedConversation = {
              ...this.selectedConversation,
              status: 'WAITING_ADMIN',
              assignedAdminId: null
            };
          }

          // Cập nhật mảng hội thoại cục bộ ngay lập tức
          this.conversations = this.conversations.map((c) => {
            if (c._id === convId) {
              return {
                ...c,
                status: 'WAITING_ADMIN',
                assignedAdminId: null,
              };
            }
            return c;
          });

          // Cập nhật số đếm cục bộ ngay lập tức
          if (this.counts.inProgress > 0) this.counts.inProgress--;
          this.counts.waiting++;

          this.loadMessages(convId);
          this.loadConversations(false);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isReturning = false;
        this.actionDialog.isLoading = false;
        this.actionDialog.errorMessage = err?.error?.message || 'Lỗi khi trả hội thoại về hàng chờ. Vui lòng thử lại.';
        this.cdr.markForCheck();
        if (err?.status === 403 || err?.status === 409) {
          this.loadConversations(false);
          this.loadConversationDetail(convId);
        }
      }
    });
  }

  private executeClose(convId: string): void {
    this.isClosing = true;
    this.cdr.markForCheck();

    this.adminService.closeConversation(convId).subscribe({
      next: (res: any) => {
        this.isClosing = false;
        this.actionDialog = {
          isOpen: false,
          isLoading: false,
          errorMessage: null,
          config: null
        };

        if (res && res.success) {
          if (this.selectedConversation && this.selectedConversation._id === convId) {
            this.selectedConversation = {
              ...this.selectedConversation,
              status: 'CLOSED',
              closedAt: new Date().toISOString()
            };
          }

          // Cập nhật mảng hội thoại cục bộ ngay lập tức
          this.conversations = this.conversations.map((c) => {
            if (c._id === convId) {
              return {
                ...c,
                status: 'CLOSED',
                closedAt: new Date().toISOString(),
              };
            }
            return c;
          });

          // Cập nhật số đếm cục bộ ngay lập tức
          if (this.counts.inProgress > 0) this.counts.inProgress--;

          this.loadMessages(convId);
          this.loadConversations(false);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isClosing = false;
        this.actionDialog.isLoading = false;
        this.actionDialog.errorMessage = err?.error?.message || 'Lỗi khi đóng phiên hỗ trợ. Vui lòng thử lại.';
        this.cdr.markForCheck();
        if (err?.status === 403 || err?.status === 409) {
          this.loadConversations(false);
          this.loadConversationDetail(convId);
        }
      }
    });
  }

  saveInternalNote(): void {
    if (!this.selectedConversation || this.isSavingNote) return;

    const convId = this.selectedConversation._id;
    this.isSavingNote = true;
    this.cdr.markForCheck();

    this.adminService.updateConversationNotes(convId, this.internalNoteText).subscribe({
      next: (res: any) => {
        this.isSavingNote = false;
        this.noteSavedSuccess = true;
        if (this.selectedConversation && this.selectedConversation._id === convId) {
          this.selectedConversation = {
            ...this.selectedConversation,
            internalNote: this.internalNoteText
          };
        }
        this.cdr.markForCheck();
        setTimeout(() => {
          this.noteSavedSuccess = false;
          this.cdr.markForCheck();
        }, 3000);
      },
      error: (err) => {
        this.isSavingNote = false;
        this.cdr.markForCheck();
        alert('Lỗi lưu ghi chú nội bộ');
      }
    });
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

  scrollToBottom(): void {
    try {
      if (this.chatPanelComponent) {
        this.chatPanelComponent.scrollToBottom();
      }
    } catch (_) {}
  }
}

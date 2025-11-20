export interface ChatUser {
  id: string;
  nickname: string;
  isOnline?: boolean;
  joinTime?: string;
  lastHeartbeat?: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  nickname: string;
  message: string;
  timestamp: string | number | Date;
  isPending?: boolean;
}


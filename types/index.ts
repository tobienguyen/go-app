export type CourtType = "beach" | "grass" | "indoor";

export interface MediaItem {
  uri: string;
  landscape: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  positions: string[];
  skillLevel: string;
  description: string;
  mediaItems: MediaItem[];
  sessionsHosted: number;
  sessionsAttended: number;
  createdAt?: any;
}

export interface Session {
  id: string;
  hostId: string;
  hostName: string;
  title: string;
  description?: string;
  type: CourtType;
  price: number;
  skillLevel: string;
  startTime?: string;
  endTime?: string;
  timeRange?: string;
  duration: string;
  maxPlayers: number;
  spotsFilled: number;
  attendees: string[];
  coordinate: { latitude: number; longitude: number };
  address: string;
  sessionDate: any;
  active: boolean;
  createdAt: any;
}

export interface Post {
  id: string;
  type: "text" | "session";
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorPosition: string;
  content: string;
  imageUrl?: string;
  likes: number;
  likedBy: string[];
  comments: number;
  createdAt: any;
  sessionId?: string;
  sessionType?: CourtType;
  sessionLocation?: string;
  sessionPrice?: number;
  sessionSkillLevel?: string;
  sessionDuration?: string;
  sessionTimeRange?: string;
}

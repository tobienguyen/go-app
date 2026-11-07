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
  createdAt?: string;
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
  courtName?: string;
  sessionDate: string;   // ISO start time
  endsAt?: string;       // ISO end time
  distanceKm?: number;   // set when the request included a location
  active: boolean;
  createdAt: string;
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
  createdAt: string;
  sessionId?: string;
  sessionType?: CourtType;
  sessionLocation?: string;
  sessionPrice?: number;
  sessionSkillLevel?: string;
  sessionDuration?: string;
  sessionTimeRange?: string;
}

export interface CyberGoatzTrackItem {
    id: string;
    trainingInstanceId: string;
    displayOrder: number;
    published: boolean;
    titleOverride: string | null;
}

export interface CyberGoatzTrack {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    bannerImageUrl: string | null;
    badgeName: string | null;
    badgeDescription: string | null;
    badgeImageUrl: string | null;
    displayOrder: number;
    published: boolean;
    createdAt: string;
    updatedAt: string;
    items: CyberGoatzTrackItem[];
}

export interface CyberGoatzTrackPayload {
    slug: string;
    title: string;
    description?: string | null;
    bannerImageUrl?: string | null;
    badgeName?: string | null;
    badgeDescription?: string | null;
    badgeImageUrl?: string | null;
    displayOrder?: number;
    published?: boolean;
}

export interface CyberGoatzTrackItemsPayload {
    items: Array<{
        trainingInstanceId: string;
        displayOrder: number;
        published: boolean;
        titleOverride?: string | null;
    }>;
}

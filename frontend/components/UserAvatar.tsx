"use client";
import { Facehash } from "facehash";

interface UserAvatarProps {
    username: string;
    size?: number;
    className?: string;
    showBlink?: boolean;
}

export default function UserAvatar({

    size = 40,
    className = "",
    showBlink = false,
}: UserAvatarProps) {
    return (
        <div
            className={`rounded-full overflow-hidden inline-block ${className}`}
            style={{ width: size, height: size }}
        >
            <Facehash
                name="mudiaga"
                size={size}
                variant="gradient"
                showInitial={false}
                enableBlink={showBlink}
                intensity3d="subtle"
            />
        </div>
    );
}
"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from 'react';
import { Users } from "lucide-react";

const AVATARS: string[] = [
    "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Woman%20Technologist.png",
    "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Man%20Student.png",
    "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Man%20Mechanic.png",
    "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Woman%20Student.png",
    "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Woman%20Teacher.png",
    "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Woman%20Technologist.png",
    "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Person%20With%20Blond%20Hair.png"
];

const AVATAR_COLORS: string[] = ['#dbeafe', '#dcfce7', '#fce7f3', '#ffedd5', '#f3f4f6'];

interface AvatarConfig {
    displayLimit: number;
    showPlus: boolean;
}

interface DigitPlaceProps {
    place: number;
    value: number;
}

const LiveVisitorCounter = ({ isCollapsed, visitorCount = 1 }: { isCollapsed?: boolean, visitorCount?: number }) => {
    const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({ displayLimit: 3, showPlus: false });

    useEffect(() => {
        const baseVisitors = 135;
        const baseAvatars = 5;
        const visitorsAboveBase = Math.max(0, visitorCount - 1); // 1 = you
        const additionalAvatars = Math.floor(visitorsAboveBase / 3);
        const calculatedLimit = Math.min(visitorCount, 5); // limit to actual people or 5
        const displayLimit = Math.max(1, Math.min(calculatedLimit, 5));
        const showPlus = visitorCount > 5;

        setAvatarConfig({ displayLimit, showPlus });
    }, [visitorCount]);

    const DigitPlace: React.FC<DigitPlaceProps> = ({ place, value }) => {
        const [offset, setOffset] = useState<number>(0);
        const targetRef = useRef<number>(0);
        const currentRef = useRef<number>(0);

        useEffect(() => {
            const valueRoundedToPlace = Math.floor(value / place);
            targetRef.current = valueRoundedToPlace % 10;

            let animationFrame: number;
            const animate = () => {
                const diff = targetRef.current - currentRef.current;
                if (Math.abs(diff) > 0.01) {
                    currentRef.current += diff * 0.15;
                    setOffset(currentRef.current);
                    animationFrame = requestAnimationFrame(animate);
                } else {
                    currentRef.current = targetRef.current;
                    setOffset(targetRef.current);
                }
            };

            animationFrame = requestAnimationFrame(animate);
            return () => cancelAnimationFrame(animationFrame);
        }, [value, place]);

        const shouldDisplay = value >= place;

        if (!shouldDisplay) return null;

        return (
            <div className="relative w-[9px] h-5 overflow-hidden">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                    let digitOffset = (10 + num - offset) % 10;
                    let translateY = digitOffset * 20;

                    if (digitOffset > 5) {
                        translateY -= 10 * 20;
                    }

                    return (
                        <span
                            key={num}
                            className="absolute left-0 text-white font-bold leading-5 h-5 flex items-center justify-center w-full"
                            style={{
                                transform: `translateY(${translateY}px)`,
                                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                            }}
                        >
                            {num}
                        </span>
                    );
                })}
            </div>
        );
    };

    const visibleAvatars = AVATARS.slice(0, avatarConfig.displayLimit);

    if (isCollapsed) {
        return (
            <div className="w-full flex justify-center py-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors" title={`${visitorCount} Online`}>
                <div className="relative">
                    <Users className="w-5 h-5 text-slate-400" />
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#18181B] animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group cursor-pointer">
            <div className="flex flex-col gap-1.5 w-full">
                <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ao Vivo</span>
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                </div>

                <div className="flex items-center justify-between mt-1">
                    <div className="avatar-stack flex -space-x-1.5">
                        {visibleAvatars.map((url, index) => (
                            <div
                                key={index}
                                className="w-6 h-6 rounded-full border-2 border-[#18181B] flex items-center justify-center overflow-hidden transition-transform hover:z-30 hover:scale-110"
                                style={{
                                    zIndex: 10 + index,
                                    backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
                                }}
                            >
                                <img src={url} alt={`Visitor ${index}`} className="w-4 h-4 object-contain drop-shadow-sm" />
                            </div>
                        ))}
                        {avatarConfig.showPlus && (
                            <div className="w-6 h-6 rounded-full bg-slate-700 border-2 border-[#18181B] text-[9px] font-bold text-white flex items-center justify-center transition-transform hover:z-30 hover:scale-110" style={{ zIndex: 20 }}>
                                <span>+</span>
                            </div>
                        )}
                    </div>

                    <div className="text-[11px] text-white font-bold bg-white/10 px-2 py-0.5 rounded-md flex items-center gap-1 border border-white/5">
                        {[10000, 1000, 100, 10, 1].map(place => (
                            <DigitPlace key={place} place={place} value={visitorCount} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveVisitorCounter;

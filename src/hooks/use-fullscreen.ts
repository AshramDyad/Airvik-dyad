"use client";

import * as React from "react";

/**
 * A hook to manage fullscreen state for a given element ref.
 * It handles the native Fullscreen API and cross-browser events.
 */
export function useFullscreen<T extends HTMLElement>() {
    const [fullscreenElement, setFullscreenElement] = React.useState<T | null>(null);
    const elementRef = React.useRef<T>(null);

    const toggleFullscreen = React.useCallback(async () => {
        if (!elementRef.current) return;

        try {
            if (!document.fullscreenElement) {
                await elementRef.current.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (error) {
            console.error("Error attempting to toggle fullscreen:", error);
        }
    }, []);

    React.useEffect(() => {
        const handleFullscreenChange = () => {
            setFullscreenElement(
                document.fullscreenElement === elementRef.current
                    ? elementRef.current
                    : null
            );
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
        document.addEventListener("mozfullscreenchange", handleFullscreenChange);
        document.addEventListener("MSFullscreenChange", handleFullscreenChange);

        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
            document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
            document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
        };
    }, []);

    return {
        elementRef,
        fullscreenElement,
        isFullscreen: fullscreenElement !== null,
        toggleFullscreen,
    };
}

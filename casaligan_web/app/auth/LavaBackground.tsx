"use client";
import React, { useEffect, useRef } from "react";

const LavaBackground: React.FC = () => {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const blobCount = 7;
		const colors = [
			"var(--color-primary)",
			"var(--color-secondary)",
			"var(--color-tertiary)",
			"var(--color-danger)",
		];

		// Clear any existing blobs (in case of re-render)
		container.innerHTML = "";

		for (let i = 0; i < blobCount; i++) {
			const blob = document.createElement("div");
			const size = Math.random() * 25 + 30;
			const duration = Math.random() * 12 + 25; 
			const left = Math.random() * 100;
			const top = Math.random() * 100;
			const color = colors[Math.floor(Math.random() * colors.length)];
			const direction = Math.random() > 0.5 ? "normal" : "reverse";

			Object.assign(blob.style, {
				position: "absolute",
				width: `${size}vmax`,
				height: `${size}vmax`,
				borderRadius: "50%",
				background: color,
				opacity: "0.7",
				mixBlendMode: "screen",
				filter: "blur(40px)",
				left: `${left}%`,
				top: `${top}%`,
				animation: `blobMove ${duration}s linear infinite ${direction}`,
				willChange: "transform",
			} as CSSStyleDeclaration);

			container.appendChild(blob);
		}
	}, []);

	return (
		<>
			<style>
				{`
        @keyframes blobMove {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          25% { transform: translate3d(10vmax, -5vmax, 0) scale(1.15); }
          50% { transform: translate3d(-5vmax, 5vmax, 0) scale(0.95); }
          75% { transform: translate3d(-12vmax, -8vmax, 0) scale(1.1); }
        }
        `}
			</style>

			<div
				ref={containerRef}
				style={{
					position: "absolute",
					inset: 0,
					overflow: "hidden",
					pointerEvents: "none",
					zIndex: 0,
				}}
			/>
		</>
	);
};

export default LavaBackground;



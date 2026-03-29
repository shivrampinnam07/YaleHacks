export function BackgroundClothes() {
  return (
    <div className="site-bg-decor" aria-hidden>
      <svg
        className="decor-shirt"
        viewBox="0 0 200 210"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M65 48c8-18 28-28 48-28s40 10 48 28l18 8c12 5 20 17 20 30v35H14v-35c0-13 8-25 20-30l18-8z"
          fill="var(--decor-shirt-fill)"
          stroke="var(--decor-outline)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M40 75c-12 0-22 10-22 22v58h164v-58c0-12-10-22-22-22"
          fill="var(--decor-shirt-fill2)"
          stroke="var(--decor-outline)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <circle cx="85" cy="52" r="5" fill="var(--decor-outline)" opacity="0.35" />
        <circle cx="115" cy="52" r="5" fill="var(--decor-outline)" opacity="0.35" />
        <path
          d="M88 62q12 8 24 0"
          stroke="var(--decor-outline)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.45"
        />
        <path
          d="M32 98c18 40 30 62 68 62s50-22 68-62"
          stroke="var(--decor-outline)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.2"
        />
      </svg>
      <svg
        className="decor-dress"
        viewBox="0 0 200 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M75 20h50c8 0 15 6 16 14l6 38h-94l6-38c1-8 8-14 16-14z"
          fill="var(--decor-dress-fill)"
          stroke="var(--decor-outline)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M48 72h104l22 100c4 18-8 36-27 36H53c-19 0-31-18-27-36l22-100z"
          fill="var(--decor-dress-fill2)"
          stroke="var(--decor-outline)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <ellipse cx="100" cy="190" rx="28" ry="8" fill="var(--decor-outline)" opacity="0.12" />
        <path
          d="M70 95c10 28 20 44 30 44s20-16 30-44"
          stroke="var(--decor-outline)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.25"
        />
        <circle cx="100" cy="48" r="6" fill="#fff" stroke="var(--decor-outline)" strokeWidth="2" />
      </svg>
    </div>
  );
}

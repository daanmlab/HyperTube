import React from 'react';

interface FortyTwoLogoProps {
  className?: string;
  size?: number;
}

export const FortyTwoLogo: React.FC<FortyTwoLogoProps> = ({
  className = 'h-4 w-4',
  size = 24,
}) => {
  return (
    <svg
      viewBox="0 -200 960 960"
      fill="currentColor"
      className={className}
      width={size}
      height={size}
    >
      <polygon
        points="32,412.6 362.1,412.6 362.1,578 526.8,578 526.8,279.1 197.3,279.1 526.8,-51.1 362.1,-51.1   32,279.1 "
      />
      <polygon points="597.9,114.2 762.7,-51.1 597.9,-51.1 " />
      <polygon
        points="762.7,114.2 597.9,279.1 597.9,443.9 762.7,443.9 762.7,279.1 928,114.2 928,-51.1 762.7,-51.1 "
      />
      <polygon points="928,279.1 762.7,443.9 928,443.9 " />
    </svg>
  );
};

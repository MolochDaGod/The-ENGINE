import React from 'react';

export const DragonHorns = React.memo(({ isLeft = false }: { isLeft?: boolean }) => {
  const segments = 8;
  const heightPerSegment = 0.135; // Doubled to maintain total height
  const baseWidth = 0.075;
  const twistAmount = Math.PI * 1.75;
  const curveAmount = 3.25;

  return (
    <group rotation={[-0.45, isLeft ? -0.7 : 0.7, isLeft ? -0.15 : 0.15]}> 
      {Array.from({ length: segments }).map((_, i) => {
        const progress = i / (segments + 1);
        const width = baseWidth * (1 - progress * 0.725);
        const twist = Math.pow(progress, 0.2) * twistAmount;
        const curve = Math.pow(progress, 2.7) * curveAmount;
        
        return (
          <group 
            key={i}
            position={[
              curve * (isLeft ? -0.15 : 0.15),
              i * heightPerSegment,
              -curve * 0.725
            ]}
            rotation={[-1.5 * progress, twist, 0]}
          >
            <mesh>
              <cylinderGeometry
                args={[width, width * 1.5, heightPerSegment, 8]}
              />
              <meshStandardMaterial
                color={`rgb(${139 - progress * 80}, ${0 + progress * 20}, ${0 + progress * 20})`}
                roughness={0.7}
                metalness={0.4}
              />
            </mesh>

            {/* Ridge details - reduced from 6 to 3 for performance */}
            {Array.from({ length: 3 }).map((_, j) => (
              <group
                key={j}
                rotation={[0, (j * 2 * Math.PI / 3), 0]}
              >
                <mesh position={[width * 0.95, 0, 0]}>
                  <boxGeometry args={[width * 0.3, heightPerSegment * 1.25 + 0.175, width * 1.5]} />
                  <meshStandardMaterial 
                    color={`rgb(${159 - progress * 100}, ${20 + progress * 20}, ${20 + progress * 20})`}
                    roughness={0.8}
                    metalness={0.3}
                  />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
});

DragonHorns.displayName = 'DragonHorns';

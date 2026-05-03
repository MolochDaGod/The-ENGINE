import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════
   AI BEHAVIOR SYSTEM — Avernus Arena NPC Brain
   States: idle → patrol → chase → attack → flee → take-cover
   Each NPC has a behavior profile that weights these states.
═══════════════════════════════════════════════════════════════ */

export type AIState = 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'take_cover' | 'ally_follow' | 'dead';
export type NPCRole = 'grunt' | 'ranged' | 'tank' | 'flanker' | 'boss' | 'ally_soldier' | 'ally_medic' | 'ally_sniper';
export type Team = 'player' | 'enemy' | 'neutral';

export interface AIProfile {
  role: NPCRole;
  team: Team;
  characterModel: 'soldier' | 'enemy' | 'hazmat';
  gunModel: string;
  health: number;
  speed: number;
  attackRange: number;
  attackDamage: number;
  attackCooldown: number;
  sightRange: number;
  fleeThreshold: number;   // HP % below which NPC flees
  aggressionBias: number;  // 0-1, higher = more aggressive
  canTakeCover: boolean;
  canFlank: boolean;
  patrolRadius: number;
}

export interface AIAgent {
  id: number;
  profile: AIProfile;
  state: AIState;
  stateTimer: number;
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  maxHealth: number;
  target: AIAgent | null;
  attackCooldown: number;
  patrolOrigin: THREE.Vector3;
  patrolTarget: THREE.Vector3 | null;
  currentPath: THREE.Vector3[];
  pathIndex: number;
  coverPosition: THREE.Vector3 | null;
  hitFlashTimer: number;
  isDying: boolean;
  deathTimer: number;
  team: Team;
  // Emissive flash restore
  originalEmissives: Map<THREE.Mesh, THREE.Color>;
}

// ═══ NPC PROFILES — presets for each role ═══
export const NPC_PROFILES: Record<NPCRole, AIProfile> = {
  grunt: {
    role: 'grunt', team: 'enemy', characterModel: 'enemy', gunModel: 'SMG',
    health: 150, speed: 3.5, attackRange: 8, attackDamage: 15, attackCooldown: 0.8,
    sightRange: 20, fleeThreshold: 0.15, aggressionBias: 0.7,
    canTakeCover: false, canFlank: false, patrolRadius: 10,
  },
  ranged: {
    role: 'ranged', team: 'enemy', characterModel: 'soldier', gunModel: 'Sniper',
    health: 100, speed: 2.5, attackRange: 25, attackDamage: 35, attackCooldown: 2.0,
    sightRange: 30, fleeThreshold: 0.3, aggressionBias: 0.3,
    canTakeCover: true, canFlank: false, patrolRadius: 8,
  },
  tank: {
    role: 'tank', team: 'enemy', characterModel: 'hazmat', gunModel: 'Shotgun',
    health: 400, speed: 1.8, attackRange: 4, attackDamage: 40, attackCooldown: 1.5,
    sightRange: 15, fleeThreshold: 0.0, aggressionBias: 1.0,
    canTakeCover: false, canFlank: false, patrolRadius: 6,
  },
  flanker: {
    role: 'flanker', team: 'enemy', characterModel: 'enemy', gunModel: 'Knife_1',
    health: 120, speed: 5.0, attackRange: 2.5, attackDamage: 50, attackCooldown: 0.5,
    sightRange: 18, fleeThreshold: 0.2, aggressionBias: 0.8,
    canTakeCover: true, canFlank: true, patrolRadius: 15,
  },
  boss: {
    role: 'boss', team: 'enemy', characterModel: 'hazmat', gunModel: 'RocketLauncher',
    health: 800, speed: 2.2, attackRange: 15, attackDamage: 60, attackCooldown: 2.5,
    sightRange: 30, fleeThreshold: 0.0, aggressionBias: 1.0,
    canTakeCover: false, canFlank: false, patrolRadius: 12,
  },
  ally_soldier: {
    role: 'ally_soldier', team: 'player', characterModel: 'soldier', gunModel: 'AK',
    health: 200, speed: 3.0, attackRange: 12, attackDamage: 20, attackCooldown: 0.6,
    sightRange: 20, fleeThreshold: 0.15, aggressionBias: 0.6,
    canTakeCover: true, canFlank: false, patrolRadius: 8,
  },
  ally_medic: {
    role: 'ally_medic', team: 'player', characterModel: 'soldier', gunModel: 'Pistol',
    health: 150, speed: 3.5, attackRange: 8, attackDamage: 10, attackCooldown: 1.0,
    sightRange: 25, fleeThreshold: 0.3, aggressionBias: 0.2,
    canTakeCover: true, canFlank: false, patrolRadius: 6,
  },
  ally_sniper: {
    role: 'ally_sniper', team: 'player', characterModel: 'soldier', gunModel: 'Sniper_2',
    health: 100, speed: 2.0, attackRange: 28, attackDamage: 45, attackCooldown: 2.5,
    sightRange: 35, fleeThreshold: 0.4, aggressionBias: 0.2,
    canTakeCover: true, canFlank: false, patrolRadius: 5,
  },
};

let nextAgentId = 0;

export function createAgent(profile: AIProfile, position: THREE.Vector3): AIAgent {
  return {
    id: nextAgentId++,
    profile,
    state: 'idle',
    stateTimer: 0,
    mesh: new THREE.Group(), // placeholder — replaced when model loads
    position: position.clone(),
    velocity: new THREE.Vector3(),
    health: profile.health,
    maxHealth: profile.health,
    target: null,
    attackCooldown: 0,
    patrolOrigin: position.clone(),
    patrolTarget: null,
    currentPath: [],
    pathIndex: 0,
    coverPosition: null,
    hitFlashTimer: 0,
    isDying: false,
    deathTimer: 0,
    team: profile.team,
    originalEmissives: new Map(),
  };
}

/* ═══════════════════════════════════════════════════════════════
   BEHAVIOR TREE TICK — called every frame for each agent
═══════════════════════════════════════════════════════════════ */
export function tickAI(
  agent: AIAgent,
  allAgents: AIAgent[],
  playerPos: THREE.Vector3,
  playerTeam: Team,
  delta: number,
  findPath?: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[] | null,
  coverPositions?: THREE.Vector3[],
) {
  if (agent.isDying || agent.state === 'dead') return;

  agent.stateTimer += delta;
  agent.attackCooldown = Math.max(0, agent.attackCooldown - delta);

  // Find nearest threat
  const threats = allAgents.filter(a =>
    a.team !== agent.team && !a.isDying && a.state !== 'dead'
  );

  // Add player as a pseudo-threat for enemy agents
  let nearestThreatDist = Infinity;
  let nearestThreatPos: THREE.Vector3 | null = null;
  let nearestThreatAgent: AIAgent | null = null;

  if (agent.team === 'enemy') {
    const dToPlayer = agent.position.distanceTo(playerPos);
    if (dToPlayer < agent.profile.sightRange) {
      nearestThreatDist = dToPlayer;
      nearestThreatPos = playerPos;
    }
  }

  for (const t of threats) {
    const d = agent.position.distanceTo(t.position);
    if (d < nearestThreatDist) {
      nearestThreatDist = d;
      nearestThreatPos = t.position;
      nearestThreatAgent = t;
    }
  }

  // For ally agents — follow player if no enemies nearby
  const isAlly = agent.team === 'player';
  const distToPlayer = agent.position.distanceTo(playerPos);

  // ═══ STATE MACHINE ═══
  const hpPct = agent.health / agent.maxHealth;

  switch (agent.state) {
    case 'idle': {
      agent.velocity.set(0, 0, 0);
      if (nearestThreatPos && nearestThreatDist < agent.profile.sightRange) {
        agent.state = 'chase';
        agent.stateTimer = 0;
      } else if (isAlly && distToPlayer > 8) {
        agent.state = 'ally_follow';
        agent.stateTimer = 0;
      } else if (agent.stateTimer > 2 + Math.random() * 3) {
        agent.state = 'patrol';
        agent.stateTimer = 0;
        agent.patrolTarget = randomPatrolPoint(agent);
      }
      break;
    }

    case 'patrol': {
      if (nearestThreatPos && nearestThreatDist < agent.profile.sightRange) {
        agent.state = 'chase';
        agent.stateTimer = 0;
        break;
      }
      if (isAlly && distToPlayer > 12) {
        agent.state = 'ally_follow';
        agent.stateTimer = 0;
        break;
      }
      if (!agent.patrolTarget || agent.position.distanceTo(agent.patrolTarget) < 1) {
        agent.state = 'idle';
        agent.stateTimer = 0;
        break;
      }
      moveToward(agent, agent.patrolTarget, delta);
      break;
    }

    case 'chase': {
      if (!nearestThreatPos) { agent.state = 'idle'; agent.stateTimer = 0; break; }

      // Check flee
      if (hpPct < agent.profile.fleeThreshold && agent.profile.fleeThreshold > 0) {
        agent.state = agent.profile.canTakeCover ? 'take_cover' : 'flee';
        agent.stateTimer = 0;
        break;
      }

      // In attack range?
      if (nearestThreatDist < agent.profile.attackRange) {
        agent.state = 'attack';
        agent.stateTimer = 0;
        break;
      }

      // Flanker tries to circle around
      if (agent.profile.canFlank && nearestThreatDist < agent.profile.sightRange * 0.7) {
        const flankDir = new THREE.Vector3()
          .subVectors(agent.position, nearestThreatPos)
          .normalize()
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        const flankTarget = nearestThreatPos.clone().add(flankDir.multiplyScalar(5));
        moveToward(agent, flankTarget, delta);
      } else {
        // Use pathfinding if available
        if (findPath && (agent.currentPath.length === 0 || agent.stateTimer > 1)) {
          const path = findPath(agent.position, nearestThreatPos);
          if (path) {
            agent.currentPath = path;
            agent.pathIndex = 0;
            agent.stateTimer = 0;
          }
        }
        if (agent.currentPath.length > 0 && agent.pathIndex < agent.currentPath.length) {
          const wp = agent.currentPath[agent.pathIndex];
          moveToward(agent, wp, delta);
          if (agent.position.distanceTo(wp) < 1.5) agent.pathIndex++;
        } else {
          moveToward(agent, nearestThreatPos, delta);
        }
      }
      break;
    }

    case 'attack': {
      if (!nearestThreatPos) { agent.state = 'idle'; agent.stateTimer = 0; break; }
      if (nearestThreatDist > agent.profile.attackRange * 1.2) {
        agent.state = 'chase'; agent.stateTimer = 0; break;
      }
      if (hpPct < agent.profile.fleeThreshold && agent.profile.fleeThreshold > 0) {
        agent.state = agent.profile.canTakeCover ? 'take_cover' : 'flee';
        agent.stateTimer = 0; break;
      }

      // Face target
      agent.mesh.lookAt(new THREE.Vector3(nearestThreatPos.x, agent.mesh.position.y, nearestThreatPos.z));
      agent.velocity.set(0, 0, 0);

      // Fire
      if (agent.attackCooldown <= 0) {
        agent.attackCooldown = agent.profile.attackCooldown;
        // Return attack info for the game loop to process
        (agent as any)._pendingAttack = {
          damage: agent.profile.attackDamage,
          targetPos: nearestThreatPos.clone(),
          targetAgent: nearestThreatAgent,
          type: agent.profile.attackRange > 5 ? 'ranged' : 'melee',
        };
      }
      break;
    }

    case 'flee': {
      if (!nearestThreatPos) { agent.state = 'idle'; agent.stateTimer = 0; break; }
      // Run away from threat
      const awayDir = new THREE.Vector3().subVectors(agent.position, nearestThreatPos).normalize();
      const fleeTarget = agent.position.clone().add(awayDir.multiplyScalar(10));
      moveToward(agent, fleeTarget, delta, 1.3); // 30% faster when fleeing
      if (agent.stateTimer > 4) { agent.state = 'idle'; agent.stateTimer = 0; }
      break;
    }

    case 'take_cover': {
      if (!coverPositions || coverPositions.length === 0) {
        agent.state = 'flee'; agent.stateTimer = 0; break;
      }
      if (!agent.coverPosition) {
        // Find nearest cover that's away from the threat
        let bestCover: THREE.Vector3 | null = null;
        let bestScore = -Infinity;
        for (const cp of coverPositions) {
          const distFromThreat = nearestThreatPos ? cp.distanceTo(nearestThreatPos) : 0;
          const distFromMe = cp.distanceTo(agent.position);
          const score = distFromThreat * 0.6 - distFromMe * 0.4; // prefer far from threat, close to me
          if (score > bestScore) { bestScore = score; bestCover = cp; }
        }
        agent.coverPosition = bestCover;
      }
      if (agent.coverPosition) {
        moveToward(agent, agent.coverPosition, delta);
        if (agent.position.distanceTo(agent.coverPosition) < 2) {
          // In cover — peek and shoot if able
          if (hpPct > agent.profile.fleeThreshold + 0.2) {
            agent.state = 'attack'; agent.stateTimer = 0; agent.coverPosition = null;
          }
        }
      }
      if (agent.stateTimer > 6) { agent.state = 'chase'; agent.stateTimer = 0; agent.coverPosition = null; }
      break;
    }

    case 'ally_follow': {
      if (nearestThreatPos && nearestThreatDist < agent.profile.sightRange) {
        agent.state = 'chase'; agent.stateTimer = 0; break;
      }
      if (distToPlayer < 5) { agent.state = 'idle'; agent.stateTimer = 0; break; }
      // Follow player with slight offset
      const offset = new THREE.Vector3(
        Math.sin(agent.id * 2.1) * 3,
        0,
        Math.cos(agent.id * 2.1) * 3,
      );
      moveToward(agent, playerPos.clone().add(offset), delta);
      break;
    }
  }

  // Apply velocity
  agent.position.add(agent.velocity.clone().multiplyScalar(delta));
  agent.position.x = Math.max(-28, Math.min(28, agent.position.x));
  agent.position.z = Math.max(-28, Math.min(28, agent.position.z));
  agent.mesh.position.lerp(agent.position, 0.15);
}

function moveToward(agent: AIAgent, target: THREE.Vector3, delta: number, speedMult = 1) {
  const dir = new THREE.Vector3().subVectors(target, agent.position);
  dir.y = 0;
  if (dir.length() < 0.5) { agent.velocity.set(0, 0, 0); return; }
  dir.normalize();
  agent.velocity.copy(dir.multiplyScalar(agent.profile.speed * speedMult));
  agent.mesh.lookAt(new THREE.Vector3(target.x, agent.mesh.position.y, target.z));
}

function randomPatrolPoint(agent: AIAgent): THREE.Vector3 {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * agent.profile.patrolRadius;
  return new THREE.Vector3(
    agent.patrolOrigin.x + Math.cos(angle) * dist,
    0,
    agent.patrolOrigin.z + Math.sin(angle) * dist,
  );
}

/* ═══════════════════════════════════════════════════════════════
   UTILITY — consume pending attack from agent
═══════════════════════════════════════════════════════════════ */
export interface PendingAttack {
  damage: number;
  targetPos: THREE.Vector3;
  targetAgent: AIAgent | null;
  type: 'ranged' | 'melee';
}

export function consumeAttack(agent: AIAgent): PendingAttack | null {
  const atk = (agent as any)._pendingAttack as PendingAttack | undefined;
  if (atk) {
    (agent as any)._pendingAttack = null;
    return atk;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   DAMAGE
═══════════════════════════════════════════════════════════════ */
export function damageAgent(agent: AIAgent, dmg: number): boolean {
  if (agent.isDying) return false;
  agent.health = Math.max(0, agent.health - dmg);
  agent.hitFlashTimer = 0.12;
  agent.originalEmissives.clear();
  agent.mesh.traverse((c: any) => {
    if (c.isMesh && c.material?.emissive) {
      agent.originalEmissives.set(c, c.material.emissive.clone());
      c.material.emissive.set(0xffffff);
      c.material.emissiveIntensity = 1;
    }
  });
  if (agent.health <= 0) {
    agent.isDying = true;
    agent.deathTimer = 0.6;
    agent.state = 'dead';
    return true; // killed
  }
  return false;
}

export function updateHitFlash(agent: AIAgent, delta: number) {
  if (agent.hitFlashTimer <= 0) return;
  agent.hitFlashTimer -= delta;
  if (agent.hitFlashTimer <= 0) {
    agent.mesh.traverse((c: any) => {
      if (c.isMesh) {
        const orig = agent.originalEmissives.get(c);
        if (orig && c.material?.emissive) {
          c.material.emissive.copy(orig);
          c.material.emissiveIntensity = 0;
        }
      }
    });
  }
}

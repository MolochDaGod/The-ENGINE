import { Badge } from "@/components/ui/badge";
import {
  TREATY_CHANNELS,
  type TreatyChannel,
  type TreatyChannelId,
} from "@/lib/treaty-chat";

type Layout = "sidebar" | "bar" | "grid";

interface TreatyChannelPickerProps {
  currentRoom: string;
  onSelect: (roomId: TreatyChannelId) => void;
  layout?: Layout;
  showDescriptions?: boolean;
}

function ChannelButton({
  channel,
  active,
  onSelect,
  layout,
  showDescriptions,
}: {
  channel: TreatyChannel;
  active: boolean;
  onSelect: (id: TreatyChannelId) => void;
  layout: Layout;
  showDescriptions?: boolean;
}) {
  const base =
    layout === "grid"
      ? "flex flex-col items-start gap-1 p-3 rounded-lg border-2 text-left transition-all hover:scale-[1.01]"
      : layout === "bar"
        ? "flex items-center gap-2 px-3 py-2 rounded-full border text-sm whitespace-nowrap transition-all shrink-0"
        : "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all";

  const activeStyle = active
    ? `border-[hsl(${channel.hue},70%,50%)}] bg-[hsl(${channel.hue},50%,20%)]/25 shadow-[0_0_12px_hsl(${channel.hue},60%,40%)/0.25]`
    : "border-[hsl(43,60%,30%)]/20 bg-black/10 hover:border-[hsl(43,60%,30%)]/50 hover:bg-[hsl(225,25%,12%)]";

  return (
    <button
      type="button"
      onClick={() => onSelect(channel.id)}
      className={`${base} ${activeStyle}`}
      aria-current={active ? "true" : undefined}
    >
      <span className="text-lg leading-none" aria-hidden>
        {channel.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block font-body font-medium ${active ? "text-[hsl(43,85%,65%)]" : "text-[hsl(45,30%,88%)]"}`}
        >
          {channel.name}
        </span>
        {(showDescriptions || layout === "grid") && (
          <span className="block text-[10px] text-[hsl(45,15%,52%)] font-body mt-0.5 line-clamp-2">
            {channel.description}
          </span>
        )}
      </span>
      {active && layout !== "bar" && (
        <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-400 shrink-0">
          Live
        </Badge>
      )}
    </button>
  );
}

export default function TreatyChannelPicker({
  currentRoom,
  onSelect,
  layout = "sidebar",
  showDescriptions = true,
}: TreatyChannelPickerProps) {
  const community = TREATY_CHANNELS.filter((c) => c.category === "community");
  const play = TREATY_CHANNELS.filter((c) => c.category === "play");
  const economy = TREATY_CHANNELS.filter((c) => c.category === "economy");

  if (layout === "bar") {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {TREATY_CHANNELS.map((channel) => (
          <ChannelButton
            key={channel.id}
            channel={channel}
            active={currentRoom === channel.id}
            onSelect={onSelect}
            layout="bar"
          />
        ))}
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {TREATY_CHANNELS.map((channel) => (
          <ChannelButton
            key={channel.id}
            channel={channel}
            active={currentRoom === channel.id}
            onSelect={onSelect}
            layout="grid"
            showDescriptions
          />
        ))}
      </div>
    );
  }

  const renderGroup = (label: string, channels: TreatyChannel[]) => (
    <div className="space-y-1.5">
      <div className="text-[10px] font-heading uppercase tracking-widest text-[hsl(45,15%,45%)] px-1">
        {label}
      </div>
      {channels.map((channel) => (
        <ChannelButton
          key={channel.id}
          channel={channel}
          active={currentRoom === channel.id}
          onSelect={onSelect}
          layout="sidebar"
          showDescriptions={showDescriptions}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {renderGroup("Community", community)}
      {renderGroup("Play", play)}
      {renderGroup("Economy", economy)}
    </div>
  );
}

export function treatyChannelById(id: string): TreatyChannel | undefined {
  return TREATY_CHANNELS.find((c) => c.id === id);
}
import { useGameStore } from '../store/useGameStore';

export function EventLog() {
  const events = useGameStore((state) => state.events);
  return (
    <section className="panel event-log">
      <p className="eyebrow">Battle Feed</p>
      {events.length === 0 ? <p className="muted">No events yet.</p> : events.map((event, index) => <p key={`${event.type}-${index}`}>{event.message}</p>)}
    </section>
  );
}

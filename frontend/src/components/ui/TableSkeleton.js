/** Animated placeholder rows shown while a list loads. Use inside <table> instead of <tbody>. */
export default function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <tbody aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, row) => (
        <tr key={row} className="border-t border-black/5">
          {Array.from({ length: cols }).map((__, col) => (
            <td key={col} className="px-4 py-4">
              <div
                className="h-4 animate-pulse rounded-full bg-slate-200"
                style={{ width: `${55 + ((row * 17 + col * 29) % 40)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
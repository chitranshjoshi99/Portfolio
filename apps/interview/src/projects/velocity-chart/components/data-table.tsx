import type { Sprint } from '../velocity-chart.types';
import { completionRate } from '../utils/chart.utils';

/** The accessible version of the chart: same numbers, as a real table. */
export function DataTable({ sprints }: { sprints: Sprint[] }) {
  return (
    <details className="vc__table">
      <summary>View data as a table</summary>
      <table>
        <caption>Velocity by sprint (story points)</caption>
        <thead>
          <tr>
            <th scope="col">Sprint</th>
            <th scope="col">Commitment</th>
            <th scope="col">Completed</th>
            <th scope="col">Completion</th>
          </tr>
        </thead>
        <tbody>
          {sprints.map((sprint) => (
            <tr key={sprint.id}>
              <th scope="row">{sprint.name}</th>
              <td>{sprint.committed}</td>
              <td>{sprint.completed}</td>
              <td>{completionRate(sprint)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

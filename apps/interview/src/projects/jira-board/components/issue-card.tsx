import type { DragEvent, KeyboardEvent } from 'react';
import type { Issue } from '../jira-board.types';

interface IssueCardProps {
  issue: Issue;
  isDragging: boolean;
  isSelected: boolean;
  onDragStart: (event: DragEvent<HTMLElement>, issueId: string) => void;
  onDragEnd: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, issueId: string) => void;
  onSelect: (issueId: string) => void;
}

export function IssueCard({ issue, isDragging, isSelected, onDragStart, onDragEnd, onKeyDown, onSelect }: IssueCardProps) {
  return (
    <li
      className={`jb__card ${isDragging ? 'is-dragging' : ''} ${isSelected ? 'is-selected' : ''}`}
      draggable
      tabIndex={0}
      // The card is the drag handle and the keyboard target; alt+arrows move it.
      aria-roledescription="Draggable issue. Press alt with arrow keys to move."
      aria-label={`${issue.key}: ${issue.summary}`}
      onDragStart={(event) => onDragStart(event, issue.id)}
      onDragEnd={onDragEnd}
      onKeyDown={(event) => onKeyDown(event, issue.id)}
      onFocus={() => onSelect(issue.id)}
      onClick={() => onSelect(issue.id)}
    >
      <p className="jb__summary">{issue.summary}</p>
      <div className="jb__meta">
        <span className={`jb__priority jb__priority--${issue.priority}`} title={`Priority: ${issue.priority}`} aria-hidden="true" />
        <span className="jb__key">{issue.key}</span>
        <span className="jb__points">{issue.points}</span>
        <span className="jb__avatar" title={issue.assignee ?? 'Unassigned'}>
          {issue.assignee ? issue.assignee[0] : '–'}
        </span>
      </div>
    </li>
  );
}

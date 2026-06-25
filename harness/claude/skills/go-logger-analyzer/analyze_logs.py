#!/usr/bin/env python3
"""
Go logger JSON log analyzer for Go projects.
Provides statistics, logger distribution, prefix tree-based field analysis, and filtering capabilities.
Supports zap, logrus, zerolog, and custom JSON log formats.
"""

import json
import sys
from collections import Counter, defaultdict
from datetime import datetime
from typing import Dict, List, Any, Optional
import argparse


class GoLogAnalyzer:
    def __init__(self, log_file: str):
        self.log_file = log_file
        self.logs: List[Dict[str, Any]] = []
        self.parse_errors: List[tuple] = []

    def load_logs(self) -> None:
        """Load and parse JSON logs from file."""
        with open(self.log_file, 'r') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    log_entry = json.loads(line)
                    self.logs.append(log_entry)
                except json.JSONDecodeError as e:
                    self.parse_errors.append((line_num, str(e), line[:100]))

    def get_logger_distribution(self) -> Dict[str, int]:
        """Count occurrences of each logger name."""
        loggers = [log.get('logger', 'unknown') for log in self.logs]
        return dict(Counter(loggers))

    def get_level_distribution(self) -> Dict[str, int]:
        """Count occurrences of each log level."""
        levels = [log.get('level', 'unknown') for log in self.logs]
        return dict(Counter(levels))

    def get_time_range(self) -> tuple[Optional[str], Optional[str]]:
        """Get first and last timestamp."""
        if not self.logs:
            return None, None

        timestamps = []
        for log in self.logs:
            ts = log.get('ts') or log.get('timestamp')
            if ts:
                timestamps.append(ts)

        if not timestamps:
            return None, None

        return min(timestamps), max(timestamps)

    def get_top_messages(self, limit: int = 10) -> List[tuple[str, int]]:
        """Get most frequent log messages."""
        messages = [log.get('msg', '') for log in self.logs]
        return Counter(messages).most_common(limit)

    def get_error_summary(self) -> List[Dict[str, Any]]:
        """Extract all error-level logs."""
        errors = [log for log in self.logs if log.get('level') == 'error']
        return errors

    def get_caller_distribution(self) -> Dict[str, int]:
        """Count occurrences by caller location."""
        callers = [log.get('caller', 'unknown') for log in self.logs]
        return dict(Counter(callers))

    def filter_logs(self,
                   level: Optional[str] = None,
                   logger: Optional[str] = None,
                   message_pattern: Optional[str] = None) -> List[Dict[str, Any]]:
        """Filter logs by criteria."""
        filtered = self.logs

        if level:
            filtered = [log for log in filtered if log.get('level') == level]

        if logger:
            filtered = [log for log in filtered if log.get('logger') == logger]

        if message_pattern:
            filtered = [log for log in filtered
                       if message_pattern.lower() in log.get('msg', '').lower()]

        return filtered

    def format_timestamp(self, ts: Any) -> str:
        """Format timestamp in a readable way."""
        if isinstance(ts, (int, float)):
            # Unix timestamp
            return datetime.fromtimestamp(ts).isoformat()
        return str(ts)

    def print_statistics(self) -> None:
        """Print comprehensive statistics."""
        print(f"📊 **Go Log Analysis Report**")
        print(f"File: {self.log_file}")
        print(f"Total entries: {len(self.logs)}")

        if self.parse_errors:
            print(f"\n⚠️  Parse errors: {len(self.parse_errors)}")
            for line_num, error, content in self.parse_errors[:5]:
                print(f"  Line {line_num}: {error}")

        print("\n**Logger Distribution:**")
        logger_dist = self.get_logger_distribution()
        for logger, count in sorted(logger_dist.items(), key=lambda x: -x[1]):
            print(f"  - {logger}: {count} entries")

        print("\n**Level Distribution:**")
        level_dist = self.get_level_distribution()
        for level, count in sorted(level_dist.items(), key=lambda x: -x[1]):
            print(f"  - {level}: {count} entries")

        first_ts, last_ts = self.get_time_range()
        if first_ts and last_ts:
            print("\n**Time Range:**")
            print(f"  First: {self.format_timestamp(first_ts)}")
            print(f"  Last:  {self.format_timestamp(last_ts)}")

        print("\n**Top Messages:**")
        top_msgs = self.get_top_messages(10)
        for i, (msg, count) in enumerate(top_msgs, 1):
            msg_preview = msg[:60] + "..." if len(msg) > 60 else msg
            print(f"  {i}. [{count}x] {msg_preview}")

        errors = self.get_error_summary()
        if errors:
            print(f"\n**Errors Found: {len(errors)}**")
            for i, err in enumerate(errors[:5], 1):
                msg = err.get('msg', '')
                logger = err.get('logger', 'unknown')
                caller = err.get('caller', '')
                print(f"  {i}. [{logger}] {msg}")
                if caller:
                    print(f"     Caller: {caller}")
                if 'error' in err:
                    print(f"     Error: {err['error']}")
                if 'stacktrace' in err:
                    stack = err['stacktrace']
                    lines = stack.split('\n')[:3]
                    print(f"     Stack: {lines[0]}")

            if len(errors) > 5:
                print(f"  ... and {len(errors) - 5} more errors")

        print("\n**Caller Distribution (Top 10):**")
        caller_dist = self.get_caller_distribution()
        for caller, count in sorted(caller_dist.items(), key=lambda x: -x[1])[:10]:
            print(f"  - {caller}: {count} entries")

    def print_filtered_logs(self, logs: List[Dict[str, Any]], limit: int = 20) -> None:
        """Print filtered logs in readable format."""
        print(f"\n**Filtered Results: {len(logs)} entries**")

        for i, log in enumerate(logs[:limit], 1):
            ts = log.get('ts') or log.get('timestamp', '')
            level = log.get('level', 'unknown').upper()
            logger = log.get('logger', 'unknown')
            msg = log.get('msg', '')
            caller = log.get('caller', '')

            print(f"\n{i}. [{self.format_timestamp(ts)}] {level} | {logger}")
            print(f"   {msg}")
            if caller:
                print(f"   📍 {caller}")

            # Print additional fields
            exclude_keys = {'ts', 'timestamp', 'level', 'logger', 'msg', 'caller'}
            extra = {k: v for k, v in log.items() if k not in exclude_keys}
            if extra:
                for key, value in extra.items():
                    if key == 'stacktrace':
                        lines = str(value).split('\n')[:2]
                        print(f"   {key}: {lines[0]}")
                    else:
                        value_str = str(value)
                        if len(value_str) > 100:
                            value_str = value_str[:100] + "..."
                        print(f"   {key}: {value_str}")

        if len(logs) > limit:
            print(f"\n... and {len(logs) - limit} more entries")
    
    def build_prefix_tree(self, logs: List[Dict[str, Any]], target_logger: str = None) -> 'PrefixTreeNode':
        """Build a prefix tree from logger field patterns only."""
        root = PrefixTreeNode()
        
        for log in logs:
            if target_logger and log.get('logger') != target_logger:
                continue
                
            # Process only the logger field
            logger_name = log.get('logger')
            if not logger_name:
                continue
                
            # Handle nested logger names (e.g., "ct.main", "ct.datactl.controller")
            logger_parts = logger_name.split('.')
            current_node = root
            
            # Build the prefix tree path for logger hierarchy
            for i, part in enumerate(logger_parts):
                if part not in current_node.children:
                    current_node.children[part] = PrefixTreeNode()
                current_node = current_node.children[part]
                current_node.count += 1
                
                # Store logger name statistics at leaf nodes
                if i == len(logger_parts) - 1:
                    current_node.add_value(logger_name)
        
        return root
    
    def print_prefix_tree_analysis(self, root: 'PrefixTreeNode', target_logger: str = None, 
                                  deep_analysis: bool = False, target_field: str = None,
                                  pattern_filter: str = None, threshold: int = 1) -> None:
        """Print prefix tree analysis results."""
        print(f"\n🌳 **Prefix Tree Analysis")
        if target_logger:
            print(f"Target Logger: {target_logger}")
        print(f"**")
        
        if target_field:
            # Show specific field subtree
            field_parts = target_field.split('.')
            current_node = root
            for part in field_parts:
                if part in current_node.children:
                    current_node = current_node.children[part]
                else:
                    print(f"Field '{target_field}' not found in logs")
                    return
            
            print(f"\n**Field Subtree: {target_field}**")
            self._print_tree_node(current_node, prefix="", threshold=threshold)
        elif deep_analysis:
            # Show full tree with all levels
            print(f"\n**Complete Field Hierarchy:**")
            self._print_tree_node(root, prefix="", threshold=threshold)
        else:
            # Default: Show only top-level logger components with summary
            print(f"\n**Top-Level Logger Components:**")
            self._print_top_level_summary(root, threshold=threshold)
            print(f"\n💡 **To explore deeper:**")
            print(f"   Use `--tree-field <component_name>` to explore specific logger subtrees")
            print(f"   Use `--tree-deep` to show complete logger hierarchy at once")
    
    def _print_top_level_summary(self, node: 'PrefixTreeNode', threshold: int = 1) -> None:
        """Print only top-level logger components with summary information."""
        # Sort children by count (descending)
        sorted_children = sorted(node.children.items(), key=lambda x: -x[1].count)
        
        for i, (name, child) in enumerate(sorted_children):
            if child.count < threshold:
                continue
                
            # Determine connector based on position
            if i == len(sorted_children) - 1:
                connector = "└── "
            else:
                connector = "├── "
            
            # Count unique logger names and determine if there are nested components
            unique_loggers = len(child.value_stats)
            has_nested = len(child.children) > 0
            
            # Create summary info for logger components
            if has_nested and unique_loggers > 0:
                summary = f" - {unique_loggers} direct loggers + nested components"
            elif has_nested:
                summary = f" - nested logger components only"
            elif unique_loggers <= 3:
                # Show all logger names if there are few
                logger_examples = [f"{k}:{v}" for k, v in sorted(child.value_stats.items(), key=lambda x: -x[1])]
                summary = f" - [{', '.join(logger_examples)}]"
            else:
                summary = f" - {unique_loggers} unique loggers"
            
            print(f"{connector}{name} ({child.count} entries){summary}")
    
    def _print_tree_node(self, node: 'PrefixTreeNode', prefix: str = "", threshold: int = 1, show_root: bool = True) -> None:
        """Recursively print a tree node and its children."""
        # Sort children by count (descending)
        sorted_children = sorted(node.children.items(), key=lambda x: -x[1].count)
        
        for i, (name, child) in enumerate(sorted_children):
            if child.count < threshold:
                continue
                
            # Determine connector based on position
            if i == len(sorted_children) - 1:
                connector = "└── "
                next_prefix = prefix + "    "
            else:
                connector = "├── "
                next_prefix = prefix + "│   "
            
            # Print child node with value info
            value_info = ""
            if child.value_stats:
                total_values = sum(child.value_stats.values())
                unique_values = len(child.value_stats)
                if unique_values <= 5:
                    # Show all values if there are few
                    value_examples = [f"{k}:{v}" for k, v in sorted(child.value_stats.items(), key=lambda x: -x[1])[:3]]
                    value_info = f" - [{', '.join(value_examples)}]"
                else:
                    value_info = f" - {unique_values} unique values"
            
            print(f"{prefix}{connector}{name} ({child.count} entries){value_info}")
            
            # Recursively print children
            if child.children:
                self._print_tree_node(child, prefix=next_prefix, threshold=threshold, show_root=True)


class PrefixTreeNode:
    """Node in a prefix tree for field analysis."""
    
    def __init__(self):
        self.children: Dict[str, 'PrefixTreeNode'] = {}
        self.count: int = 0
        self.value_stats: Dict[Any, int] = defaultdict(int)
    
    def add_value(self, value: Any) -> None:
        """Add a value to the node's value statistics."""
        self.value_stats[value] += 1


def main():
    parser = argparse.ArgumentParser(description='Analyze Go JSON logs with prefix tree analysis')
    parser.add_argument('logfile', help='Path to log file')
    parser.add_argument('--level', help='Filter by log level (info, warn, error, debug)')
    parser.add_argument('--logger', help='Filter by logger name')
    parser.add_argument('--message', help='Filter by message pattern (case-insensitive)')
    parser.add_argument('--limit', type=int, default=20, help='Limit filtered output (default: 20)')
    parser.add_argument('--stats-only', action='store_true', help='Only show statistics, no filtered logs')
    
    # Prefix tree analysis options
    parser.add_argument('--prefix-tree', action='store_true', help='Perform prefix tree-based field analysis')
    parser.add_argument('--tree-deep', action='store_true', help='Show detailed prefix tree structure')
    parser.add_argument('--tree-field', help='Analyze specific field subtree')
    parser.add_argument('--tree-pattern', help='Find fields matching prefix pattern')
    parser.add_argument('--tree-threshold', type=int, default=1, help='Minimum occurrences for field display (default: 1)')

    args = parser.parse_args()

    try:
        analyzer = GoLogAnalyzer(args.logfile)
        analyzer.load_logs()

        # Always show statistics
        analyzer.print_statistics()

        # Show filtered logs if filters are applied
        if not args.stats_only and (args.level or args.logger or args.message):
            filtered = analyzer.filter_logs(
                level=args.level,
                logger=args.logger,
                message_pattern=args.message
            )
            analyzer.print_filtered_logs(filtered, limit=args.limit)
        
        # Perform prefix tree analysis if requested
        if args.prefix_tree:
            print(f"\n🌳 **Building Prefix Tree...**")
            
            # Build the prefix tree
            root = analyzer.build_prefix_tree(analyzer.logs, target_logger=args.logger)
            
            # Print the analysis
            analyzer.print_prefix_tree_analysis(
                root, 
                target_logger=args.logger,
                deep_analysis=args.tree_deep,
                target_field=args.tree_field,
                pattern_filter=args.tree_pattern,
                threshold=args.tree_threshold
            )

    except FileNotFoundError:
        print(f"Error: File not found: {args.logfile}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

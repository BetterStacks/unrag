#!/bin/bash

# Export Excalidraw files to PNG
# Usage:
#   ./export-excalidraw.sh -o <output-dir> <excalidraw-files...>
#   ./export-excalidraw.sh --output <output-dir> <excalidraw-files...>
#   ./export-excalidraw.sh --output=<output-dir> <excalidraw-files...>
#
# Examples:
#   ./export-excalidraw.sh -o ./output file1.excalidraw.json file2.excalidraw.json
#   ./export-excalidraw.sh --output ./output *.excalidraw.json

set -euo pipefail

output_dir="."

print_usage() {
  cat <<EOF
Usage: $0 [-o <output-dir> | --output <output-dir> | --output=<output-dir>] <excalidraw-files...>
Example: $0 -o ./output *.excalidraw.json
EOF
}

# Parse options (supports short + long flags)
inputs=()
while [ $# -gt 0 ]; do
  case "$1" in
    -o)
      shift
      if [ $# -eq 0 ]; then
        echo "Error: -o requires a value" >&2
        print_usage
        exit 1
      fi
      output_dir="$1"
      shift
      ;;
    --output)
      shift
      if [ $# -eq 0 ]; then
        echo "Error: --output requires a value" >&2
        print_usage
        exit 1
      fi
      output_dir="$1"
      shift
      ;;
    --output=*)
      output_dir="${1#--output=}"
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    --)
      shift
      while [ $# -gt 0 ]; do
        inputs+=("$1")
        shift
      done
      ;;
    -*)
      echo "Error: unknown option: $1" >&2
      print_usage
      exit 1
      ;;
    *)
      inputs+=("$1")
      shift
      ;;
  esac
done

if [ ${#inputs[@]} -eq 0 ]; then
  print_usage
  exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$output_dir"

for input in "${inputs[@]}"; do
  if [ ! -f "$input" ]; then
    echo "Skipping: $input (not found)"
    continue
  fi

  # Get basename and replace .excalidraw.json or .excalidraw with .png
  filename=$(basename "$input")
  filename="${filename%.excalidraw.json}.png"
  filename="${filename%.excalidraw}.png"
  output="$output_dir/$filename"

  echo "Exporting: $input -> $output"
  excalidraw-brute-export-cli \
    -i "$input" \
    -o "$output" \
    -f png \
    -s 2 \
    -d
done

echo "Done!"

#!/bin/bash

# APEX Test Directory Cleanup Script (Unix/Linux/macOS)
#
# This script provides cross-platform removal of .apex-test directories,
# handling cases where the directory doesn't exist and ensuring compatibility
# with Unix-like systems.
#
# Usage:
#   ./scripts/cleanup-test-directory.sh
#   ./scripts/cleanup-test-directory.sh /path/to/specific/.apex-test

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to remove directory safely
remove_directory() {
    local dir_path="$1"

    if [ ! -e "$dir_path" ]; then
        print_info "Directory does not exist: $dir_path"
        return 0
    fi

    if [ ! -d "$dir_path" ]; then
        print_warning "Path exists but is not a directory: $dir_path"
        return 0
    fi

    echo "Removing directory: $dir_path"

    # Try to remove with proper error handling
    if rm -rf "$dir_path" 2>/dev/null; then
        print_success "Successfully removed: $dir_path"
    else
        print_warning "Permission denied - attempting to fix permissions..."

        # Try to fix permissions and remove again
        if chmod -R u+w "$dir_path" 2>/dev/null && rm -rf "$dir_path" 2>/dev/null; then
            print_success "Successfully removed after permission fix: $dir_path"
        else
            print_error "Failed to remove $dir_path due to permission restrictions"
            print_info "Manual cleanup may be required for: $dir_path"
            return 1
        fi
    fi
}

# Function to find all .apex-test directories
find_apex_test_directories() {
    local root_dir="$1"

    # Find .apex-test directories, excluding node_modules and other hidden directories
    find "$root_dir" -name ".apex-test" -type d 2>/dev/null | grep -v "/node_modules/" | grep -v "/\\.git/" || true
}

# Main cleanup function
cleanup_test_directories() {
    local project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

    echo "🧹 Starting .apex-test directory cleanup..."
    print_info "Searching from project root: $project_root"

    # Find all .apex-test directories
    mapfile -t apex_test_dirs < <(find_apex_test_directories "$project_root")

    if [ ${#apex_test_dirs[@]} -eq 0 ]; then
        print_info "No .apex-test directories found."
        return 0
    fi

    echo "📁 Found ${#apex_test_dirs[@]} .apex-test director$([ ${#apex_test_dirs[@]} -eq 1 ] && echo "y" || echo "ies"):"
    for dir in "${apex_test_dirs[@]}"; do
        echo "   - $dir"
    done

    # Remove all found directories
    local error_count=0
    for dir in "${apex_test_dirs[@]}"; do
        if ! remove_directory "$dir"; then
            ((error_count++))
        fi
    done

    if [ $error_count -gt 0 ]; then
        print_error "Cleanup completed with $error_count error$([ $error_count -eq 1 ] && echo "" || echo "s")"
        return 1
    else
        print_success "Cleanup completed successfully!"
        return 0
    fi
}

# Show help function
show_help() {
    echo "🧹 APEX Test Directory Cleanup Utility (Shell Script)"
    echo ""
    echo "Usage:"
    echo "  ./scripts/cleanup-test-directory.sh [options] [path]"
    echo ""
    echo "Options:"
    echo "  --help, -h     Show this help message"
    echo "  path          Specific .apex-test directory path to remove"
    echo ""
    echo "Examples:"
    echo "  # Clean up all .apex-test directories in project"
    echo "  ./scripts/cleanup-test-directory.sh"
    echo ""
    echo "  # Clean up specific directory"
    echo "  ./scripts/cleanup-test-directory.sh /path/to/.apex-test"
    echo ""
    echo "  # Show help"
    echo "  ./scripts/cleanup-test-directory.sh --help"
    echo ""
    echo "Features:"
    echo "  ✅ Cross-platform compatibility (Unix/Linux/macOS)"
    echo "  ✅ Handles cases where directory doesn't exist"
    echo "  ✅ Recursive directory removal"
    echo "  ✅ Permission error recovery"
    echo "  ✅ Detailed logging"
}

# Main execution
main() {
    # Parse arguments
    if [[ "$1" == "--help" || "$1" == "-h" ]]; then
        show_help
        return 0
    fi

    # Check if specific path was provided
    if [ $# -gt 0 ] && [[ "$1" != -* ]]; then
        local target_path="$(realpath "$1")"
        echo "🧹 Cleaning up specific directory: $target_path"

        if remove_directory "$target_path"; then
            print_success "Specific directory cleanup completed successfully!"
        else
            print_error "Specific directory cleanup failed"
            exit 1
        fi
    else
        if cleanup_test_directories; then
            echo ""
            print_success "All .apex-test directories have been cleaned up!"
        else
            echo ""
            print_error "Some directories could not be cleaned up. See messages above."
            exit 1
        fi
    fi
}

# Execute main function with all arguments
main "$@"
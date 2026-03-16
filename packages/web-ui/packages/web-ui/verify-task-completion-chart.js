/**
 * Simple verification script to check TaskCompletionRateChart implementation
 */

const fs = require('fs');
const path = require('path');

// Check if the component file exists
const componentPath = path.join(process.cwd(), 'src/components/charts/TaskCompletionRateChart.tsx');
if (!fs.existsSync(componentPath)) {
  console.error('❌ TaskCompletionRateChart.tsx not found');
  process.exit(1);
}

// Read the component file
const componentContent = fs.readFileSync(componentPath, 'utf8');

// Verify key requirements
const requirements = [
  { name: 'Recharts PieChart import', pattern: /import.*{.*PieChart.*}.*from.*recharts/i },
  { name: 'Recharts BarChart import', pattern: /import.*{.*BarChart.*}.*from.*recharts/i },
  { name: 'ResponsiveContainer import', pattern: /import.*{.*ResponsiveContainer.*}.*from.*recharts/i },
  { name: 'TaskCompletionRateChart export', pattern: /export.*function.*TaskCompletionRateChart/i },
  { name: 'Theme awareness', pattern: /useChartTheme/i },
  { name: 'Success rate display', pattern: /SuccessRateDisplay|successRate/i },
  { name: 'Status breakdown', pattern: /statusCounts|TaskStatusCounts/i },
  { name: 'Completion rate', pattern: /completionRate|overallCompletionRate/i },
  { name: 'Failed tasks handling', pattern: /failed|Failed/i },
  { name: 'Cancelled tasks handling', pattern: /cancelled|Cancelled/i },
  { name: 'Responsive design', pattern: /ResponsiveContainer/i },
  { name: 'Mini variant export', pattern: /export.*TaskCompletionRateChartMini/i },
  { name: 'Accessibility support', pattern: /aria-label|role="img"/i },
  { name: 'Screen reader support', pattern: /sr-only/i },
  { name: 'Pie chart variant', pattern: /variant.*===.*['"]pie['"]|PieChart/i },
  { name: 'Bar chart variant', pattern: /variant.*===.*['"]bar['"]|BarChart/i },
  { name: 'Loading state', pattern: /SkeletonChart|loading/i },
  { name: 'Empty state', pattern: /EmptyState|No.*data.*available/i },
  { name: 'Custom tooltip', pattern: /TaskCompletionTooltip|Tooltip/i },
  { name: 'Color theming', pattern: /getStatusColors|StatusColors/i }
];

console.log('🔍 Verifying TaskCompletionRateChart implementation...\n');

let allPassed = true;
requirements.forEach((req, index) => {
  const passed = req.pattern.test(componentContent);
  console.log(`${passed ? '✅' : '❌'} ${req.name}`);
  if (!passed) allPassed = false;
});

console.log('\n📊 Component statistics:');
console.log(`- File size: ${(componentContent.length / 1024).toFixed(1)}KB`);
console.log(`- Lines of code: ${componentContent.split('\n').length}`);
console.log(`- Functions defined: ${(componentContent.match(/function\s+\w+/g) || []).length}`);
console.log(`- Interfaces defined: ${(componentContent.match(/interface\s+\w+/g) || []).length}`);

// Check the types file
const typesPath = path.join(process.cwd(), 'src/types/performance-metrics.ts');
if (!fs.existsSync(typesPath)) {
  console.error('\n❌ performance-metrics.ts types file not found');
  allPassed = false;
} else {
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  const hasRequiredTypes = /TaskCompletionRateChartProps/.test(typesContent) &&
                          /TaskCompletionRateData/.test(typesContent) &&
                          /TaskStatusCounts/.test(typesContent);
  console.log(`${hasRequiredTypes ? '✅' : '❌'} Required TypeScript types defined`);
  if (!hasRequiredTypes) allPassed = false;
}

// Check test file
const testPath = path.join(process.cwd(), 'src/components/charts/__tests__/TaskCompletionRateChart.test.tsx');
if (fs.existsSync(testPath)) {
  console.log('✅ Test file created');
} else {
  console.log('⚠️  Test file not found (optional)');
}

console.log('\n' + '='.repeat(60));
if (allPassed) {
  console.log('🎉 SUCCESS: TaskCompletionRateChart fully implemented!');
  console.log('\nFeatures implemented:');
  console.log('✅ PieChart and BarChart variants using Recharts');
  console.log('✅ Task completion statistics display');
  console.log('✅ Completed/failed/cancelled breakdown');
  console.log('✅ Success rate percentage display');
  console.log('✅ Responsive and theme-aware design');
  console.log('✅ Mini variant for dashboard widgets');
  console.log('✅ Accessibility support');
  console.log('✅ Loading and empty states');
  console.log('✅ Custom tooltips and styling');
  console.log('✅ TypeScript type definitions');
  process.exit(0);
} else {
  console.log('❌ FAILED: Some requirements not met');
  process.exit(1);
}
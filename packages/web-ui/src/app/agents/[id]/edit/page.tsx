'use client'

import { AgentConfigEditor } from '@/components/agent-editor/AgentConfigEditor'
import { use } from 'react'

interface EditAgentPageProps {
  params: Promise<{
    id: string
  }>
}

export default function EditAgentPage({ params }: EditAgentPageProps) {
  const resolvedParams = use(params)
  return <AgentConfigEditor agentId={resolvedParams.id} />
}
"use client"

import { useState, useEffect, useRef } from "react"
import { Mail, Calendar, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useThrottle } from "@/hooks/use-throttle"
import { EMAIL_CONFIG } from "@/config"

interface Message {
  id: string
  from_address: string
  subject: string
  received_at: number
}

interface MessageListProps {
  email: {
    id: string
    address: string
  }
  onMessageSelect: (messageId: string) => void
  selectedMessageId?: string | null
}

interface MessageResponse {
  messages: Message[]
  nextCursor: string | null
  total: number
}

export function MessageList({ email, onMessageSelect, selectedMessageId }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const pollTimeoutRef = useRef<Timer>()
  const messagesRef = useRef<Message[]>([]) // 添加 ref 来追踪最新的消息列表
  const [total, setTotal] = useState(0)

  // 当 messages 改变时更新 ref
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const fetchMessages = async (cursor?: string) => {
    try {
      const url = new URL(`/api/emails/${email.id}`, window.location.origin)
      if (cursor) {
        url.searchParams.set('cursor', cursor)
      }
      const response = await fetch(url)
      const data = await response.json() as MessageResponse
      
      if (!cursor) {
        const newMessages = data.messages
        const oldMessages = messagesRef.current

        const lastDuplicateIndex = newMessages.findIndex(
          newMsg => oldMessages.some(oldMsg => oldMsg.id === newMsg.id)
        )

        if (lastDuplicateIndex === -1) {
          setMessages(newMessages)
          setNextCursor(data.nextCursor)
          setTotal(data.total)
          return
        }
        const uniqueNewMessages = newMessages.slice(0, lastDuplicateIndex)
        setMessages([...uniqueNewMessages, ...oldMessages])
        setTotal(data.total)
        return
      }
      setMessages(prev => [...prev, ...data.messages])
      setNextCursor(data.nextCursor)
      setTotal(data.total)
    } catch (error) {
      console.error("Failed to fetch messages:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }

  const startPolling = () => {
    stopPolling()
    pollTimeoutRef.current = setInterval(() => {
      if (!refreshing && !loadingMore) {
        fetchMessages()
      }
    }, EMAIL_CONFIG.POLL_INTERVAL)
  }

  const stopPolling = () => {
    if (pollTimeoutRef.current) {
      clearInterval(pollTimeoutRef.current)
      pollTimeoutRef.current = undefined
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchMessages()
  }

  const handleScroll = useThrottle((e: React.UIEvent<HTMLDivElement>) => {
    if (loadingMore) return

    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    const threshold = clientHeight * 1.5
    const remainingScroll = scrollHeight - scrollTop

    if (remainingScroll <= threshold && nextCursor) {
      setLoadingMore(true)
      fetchMessages(nextCursor)
    }
  }, 200)

  useEffect(() => {
    if (!email.id) {
      return
    }
    setLoading(true)
    setNextCursor(null)
    fetchMessages()
    startPolling() 

    return () => {
      stopPolling() 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email.id])

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 flex justify-between items-center border-b border-primary/20">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn("h-8 w-8", refreshing && "animate-spin")}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <span className="text-xs text-gray-500">
          {total > 0 ? `${total} 封邮件` : "暂无邮件"}
        </span>
      </div>

      <div className="flex-1 overflow-auto" onScroll={handleScroll}>
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-500">加载中...</div>
        ) : messages.length > 0 ? (
          <div className="divide-y divide-primary/10">
            {messages.map(message => (
              <div
                key={message.id}
                onClick={() => onMessageSelect(message.id)}
                className={cn(
                  "p-3 hover:bg-primary/5 cursor-pointer",
                  selectedMessageId === message.id && "bg-primary/10"
                )}
              >
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-primary/60 mt-1" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{message.subject}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <span className="truncate">{message.from_address}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(message.received_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {loadingMore && (
              <div className="text-center text-sm text-gray-500 py-2">
                加载更多...
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-gray-500">
            暂无邮件
          </div>
        )}
      </div>
    </div>
  )
} 
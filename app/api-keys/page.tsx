"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Copy, Plus, Trash2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ApiKeyService } from "@/lib/services/api-key-service"

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState("")
  const [generatingKey, setGeneratingKey] = useState(false)
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null)

  useEffect(() => {
    fetchApiKeys()
  }, [])

  const fetchApiKeys = async () => {
    try {
      setLoading(true)
      const apiKeyService = new ApiKeyService()
      const keys = await apiKeyService.getAllApiKeys()
      setApiKeys(keys)
    } catch (error) {
      console.error("Error fetching API keys:", error)
    } finally {
      setLoading(false)
    }
  }

  const generateApiKey = async () => {
    if (!newKeyName.trim()) return

    try {
      setGeneratingKey(true)
      const apiKeyService = new ApiKeyService()
      const newKey = await apiKeyService.generateApiKey(newKeyName)

      setApiKeys([newKey, ...apiKeys])
      setNewlyGeneratedKey(newKey.key)
      setNewKeyName("")
    } catch (error) {
      console.error("Error generating API key:", error)
    } finally {
      setGeneratingKey(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert("API key copied to clipboard")
      })
      .catch((err) => {
        console.error("Failed to copy: ", err)
      })
  }

  const toggleKeyStatus = async (id: string, currentStatus: string) => {
    try {
      const apiKeyService = new ApiKeyService()
      const newStatus = currentStatus === "active" ? "inactive" : "active"
      await apiKeyService.updateApiKeyStatus(id, newStatus as any)

      setApiKeys(apiKeys.map((key) => (key.id === id ? { ...key, status: newStatus } : key)))
    } catch (error) {
      console.error("Error toggling API key status:", error)
    }
  }

  const deleteKey = async (id: string) => {
    if (confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
      try {
        const apiKeyService = new ApiKeyService()
        await apiKeyService.deleteApiKey(id)
        setApiKeys(apiKeys.filter((key) => key.id !== id))
      } catch (error) {
        console.error("Error deleting API key:", error)
      }
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="mb-6 flex items-center">
          <Button variant="outline" size="icon" className="mr-4" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
            <p className="text-muted-foreground">Manage API keys for external integrations</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="loading-gradient h-2 w-40 rounded-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center">
        <Button variant="outline" size="icon" className="mr-4" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">Manage API keys for external integrations</p>
        </div>
      </div>

      <Card className="mb-6 gradient-card">
        <CardHeader>
          <CardTitle>Generate New API Key</CardTitle>
          <CardDescription>Create a new API key for external services to access the compliance engine</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label htmlFor="keyName" className="mb-2 block text-sm font-medium">
                Key Name
              </label>
              <Input
                id="keyName"
                placeholder="e.g., Lead Site 3"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <Button onClick={generateApiKey} disabled={!newKeyName.trim() || generatingKey} variant="gradient">
              {generatingKey ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Key
                </>
              )}
            </Button>
          </div>

          {newlyGeneratedKey && (
            <div className="mt-4 p-4 border rounded-md bg-muted">
              <div className="flex justify-between items-center">
                <p className="font-mono text-sm">{newlyGeneratedKey}</p>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(newlyGeneratedKey)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Make sure to copy this key now. For security reasons, it won't be displayed again.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gradient-card">
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Manage existing API keys</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No API keys found. Generate your first key above.
                    </TableCell>
                  </TableRow>
                ) : (
                  apiKeys.map((apiKey) => (
                    <TableRow key={apiKey.id}>
                      <TableCell className="font-medium">{apiKey.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <span className="font-mono text-xs">
                            {apiKey.key.substring(0, 8)}...{apiKey.key.substring(apiKey.key.length - 4)}
                          </span>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(apiKey.key)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(apiKey.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleDateString() : "Never"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={apiKey.status === "active" ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => toggleKeyStatus(apiKey.id, apiKey.status)}
                        >
                          {apiKey.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteKey(apiKey.id)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

import { supabase } from './supabase'

export const chatService = {
  // Create a new conversation
  async createConversation(userId) {
    const { data, error } = await supabase
      .from('conversations')
      .insert([{ user_id: userId }])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Get all conversations for a user
  async getConversations(userId) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // Get messages for a conversation
  async getMessages(conversationId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data
  },

  // Add a message to a conversation
  async addMessage(conversationId, role, content) {
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        role,
        content
      }])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Delete a conversation and all its messages
  async deleteConversation(conversationId) {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
    
    if (error) throw error
  }
}

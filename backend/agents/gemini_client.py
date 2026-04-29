import os
import json
from google import genai
from google.genai import types
from typing import Optional, Dict, Any

class GeminiClient:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            print("WARNING: GEMINI_API_KEY not found in environment variables.")
        # Initialize the new Google GenAI SDK client
        self.client = genai.Client(api_key=api_key)
        # Using gemini-2.0-flash as it's the specified model for grounding
        self.model_id = 'gemini-2.0-flash'

    async def generate_structured_json(self, prompt: str, schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generates a structured JSON response using Gemini with Google Search grounding.
        """
        full_prompt = prompt
        if schema:
            full_prompt += f"\n\nReturn the result strictly as a JSON object matching this schema: {json.dumps(schema)}"
        
        # Configure Google Search grounding tool as per the documentation:
        # https://ai.google.dev/gemini-api/docs/google-search
        grounding_tool = types.Tool(
            google_search=types.GoogleSearch()
        )
        
        config = types.GenerateContentConfig(
            tools=[grounding_tool],
            response_mime_type="application/json"
        )
        
        try:
            # Use the async (aio) models generate_content method
            response = await self.client.aio.models.generate_content(
                model=self.model_id,
                contents=full_prompt,
                config=config
            )
            
            if not response.text:
                print(f"WARNING: Gemini returned empty text for prompt: {full_prompt[:100]}...")
                return {}
                
            return json.loads(response.text)
            
        except Exception as e:
            print(f"Gemini call failed with tools: {e}. Retrying without tools...")
            try:
                # Fallback: Try without search grounding tools if quota or other tool errors occur
                config_no_tools = types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
                response = await self.client.aio.models.generate_content(
                    model=self.model_id,
                    contents=full_prompt,
                    config=config_no_tools
                )
                return json.loads(response.text)
            except Exception as e2:
                print(f"Gemini call failed entirely: {e2}")
                return {}

gemini_client = GeminiClient()

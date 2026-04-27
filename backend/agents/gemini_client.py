import os
import json
import google.generativeai as genai
from typing import Optional, Dict, Any

class GeminiClient:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            print("WARNING: GEMINI_API_KEY not found in environment variables.")
        genai.configure(api_key=api_key)
        # Using gemini-flash-latest to stay on the best available flash model
        self.model = genai.GenerativeModel(
            model_name='gemini-flash-latest'
        )

    async def generate_structured_json(self, prompt: str, schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generates a structured JSON response using Gemini.
        """
        full_prompt = prompt
        if schema:
            full_prompt += f"\n\nReturn the result strictly as a JSON object matching this schema: {json.dumps(schema)}"
        
        # Using google_search_retrieval for search grounding with fallback
        try:
            response = self.model.generate_content(
                full_prompt,
                generation_config={"response_mime_type": "application/json"},
                tools=[{"google_search_retrieval": {}}]
            )
        except Exception as e:
            print(f"Gemini call failed with tools: {e}. Retrying without tools...")
            try:
                response = self.model.generate_content(
                    full_prompt,
                    generation_config={"response_mime_type": "application/json"}
                )
            except Exception as e2:
                print(f"Gemini call failed entirely: {e2}")
                return {}
        
        try:
            return json.loads(response.text)
        except json.JSONDecodeError:
            print(f"Failed to decode JSON from Gemini response: {response.text}")
            return {}

gemini_client = GeminiClient()

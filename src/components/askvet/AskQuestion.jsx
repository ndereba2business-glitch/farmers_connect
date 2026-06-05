import React, { useState } from "react";
import {
  MessageSquare,
  ImagePlus,
  Send,
} from "lucide-react";

const categories = [
  "Disease Symptoms",
  "Vaccination",
  "Feeding",
  "Egg Production",
  "Chick Mortality",
  "Broiler Growth",
  "Layers",
  "Emergency",
];

export default function AskQuestion() {
  const [question, setQuestion] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("Disease Symptoms");

  const [submitted, setSubmitted] =
    useState(false);

  const handleSubmit = () => {
    if (!question.trim()) return;

    console.log({
      question,
      category: selectedCategory,
      timestamp: new Date(),
    });

    setSubmitted(true);
    setQuestion("");

    setTimeout(() => {
      setSubmitted(false);
    }, 2500);
  };

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="bg-white border border-[#e5e7eb] rounded-[24px] p-6">
        
        <h2 className="text-[20px] font-semibold text-[#1f2937] flex items-center gap-2 mb-5">
          <MessageSquare className="w-5 h-5 text-[#16a34a]" />
          Ask a Vet Question
        </h2>

        {/* CATEGORY PILLS */}
        <div className="flex flex-wrap gap-3 mb-5">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() =>
                setSelectedCategory(item)
              }
              className={`
                px-4 py-2 rounded-full text-sm font-medium border transition-all

                ${
                  selectedCategory === item
                    ? "bg-[#fee2e2] text-[#dc2626] border-[#fecaca]"
                    : "bg-white text-[#64748b] border-[#e5e7eb] hover:bg-[#f8fafc]"
                }
              `}
            >
              {item}
            </button>
          ))}
        </div>

        {/* TEXTAREA */}
        <textarea
          placeholder="Describe the problem in detail — symptoms, bird age, number affected, how long..."
          value={question}
          onChange={(e) =>
            setQuestion(e.target.value)
          }
          className="
            w-full
            h-[150px]
            rounded-[20px]
            border
            border-[#e5e7eb]
            bg-[#fcfcfc]
            p-5
            text-[15px]
            resize-none
            outline-none
            focus:ring-2
            focus:ring-green-200
          "
        />

        {/* ACTIONS */}
        <div className="flex flex-col md:flex-row gap-3 mt-4">
          
          {/* IMAGE BUTTON */}
          <button
            className="
              flex-1
              border
              border-dashed
              border-[#d1d5db]
              rounded-[18px]
              h-[56px]
              flex
              items-center
              justify-center
              gap-2
              text-[#64748b]
              hover:bg-[#f8fafc]
              transition-all
            "
          >
            <ImagePlus className="w-5 h-5" />
            Attach photos
          </button>

          {/* SUBMIT */}
          <button
            onClick={handleSubmit}
            className="
              flex-1
              h-[56px]
              rounded-[18px]
              bg-[#86b996]
              hover:bg-[#74ab86]
              text-white
              font-semibold
              flex
              items-center
              justify-center
              gap-2
              transition-all
            "
          >
            <Send className="w-5 h-5" />
            Submit
          </button>
        </div>

        {/* SUCCESS */}
        {submitted && (
          <div className="mt-4 text-green-600 text-sm font-medium">
            Question submitted successfully
          </div>
        )}
      </div>
    </div>
  );
}
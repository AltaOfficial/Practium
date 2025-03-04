"use client";
import { useEffect, useState } from "react";
import { sendCheckWithAI, getAssessment } from "./actions";
import { useParams } from "next/navigation";
import { Database } from "@/utils/supabase/database.types";
import { FiCheck, FiChevronDown, FiX } from "react-icons/fi";
import { DropdownMenu, RadioGroup, TextArea } from "@radix-ui/themes";
import { Button } from "@radix-ui/themes";
import { FaCircleChevronLeft } from "react-icons/fa6";
import Link from "next/link";
import { MathJax } from "better-react-mathjax";
import ChatWithAI from "@/components/ChatWithAI";

type Question = Database["public"]["Tables"]["questions"]["Row"];

export default function page() {
  const params = useParams();
  const [questions, setQuestions] = useState<Question[]>();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isCheckingWithAI, setIsCheckingWithAI] = useState(false);
  useEffect(() => {
    getAssessment({
      assessmentId: parseInt(params.assessment_id as string),
    }).then(({ data }) => {
      console.log(data);
      setQuestions(data);
    });
  }, []);

  function checkWithAI({
    question,
    answer,
  }: {
    question: Question;
    answer: string | undefined | null;
  }) {
    setIsCheckingWithAI(true);
    sendCheckWithAI({ question, answer }).then((data) => {
      if (data.error) {
        return console.error(data.error);
      }
      setQuestions(
        questions?.filter((questionItem) => {
          if (questionItem.id == question.id) {
            questionItem.is_answered = true;
            questionItem.is_correct = data.correct;
            return questionItem;
          } else {
            return questionItem;
          }
        })
      );
      setIsCheckingWithAI(false);
    });
  }

  return (
    <div className="grid grid-cols-2">
      <div className="p-3 max-w-screen-md">
        <Link href={`/dashboard/practice/courses/${params.course_id}`}>
          <FaCircleChevronLeft className="mb-2" />
        </Link>
        <div className="mb-2">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button className="hover:cursor-pointer" variant="outline">
                Question {currentQuestion + 1}
                <DropdownMenu.TriggerIcon />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              {questions &&
                questions.map((question, index) => {
                  return (
                    <DropdownMenu.Item
                      onClick={() => {
                        setCurrentQuestion(index);
                        setCurrentAnswer("");
                      }}
                      key={index}
                    >
                      Question {index + 1}{" "}
                      {question.is_correct == true ? (
                        <FiCheck color="green" />
                      ) : question.is_answered == true ? (
                        <FiX color="red" />
                      ) : (
                        ""
                      )}
                    </DropdownMenu.Item>
                  );
                })}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>

        <div
          className={`p-3 flex flex-col gap-4 ${
            questions && questions[currentQuestion].is_correct == true
              ? "border-2 border-green-400"
              : questions && questions[currentQuestion].is_answered == true
              ? "border-2 border-red-400"
              : ""
          }`}
        >
          {questions && (
            <div>
              <MathJax className="mjx-container mb-4">
                {questions[currentQuestion].question}
              </MathJax>
              {questions[currentQuestion].question_type == "MCQ" && (
                <RadioGroup.Root onValueChange={setCurrentAnswer}>
                  {questions[currentQuestion].answers?.map((answer, index) => {
                    return (
                      <RadioGroup.Item key={index} value={answer}>
                        {answer}
                      </RadioGroup.Item>
                    );
                  })}
                </RadioGroup.Root>
              )}
              {questions[currentQuestion].question_type == "BOOL" && (
                <RadioGroup.Root onValueChange={setCurrentAnswer}>
                  <RadioGroup.Item value={"true"}>True</RadioGroup.Item>
                  <RadioGroup.Item value={"false"}>False</RadioGroup.Item>
                </RadioGroup.Root>
              )}
              {questions[currentQuestion].question_type == "LATEX" && (
                <TextArea
                  value={currentAnswer}
                  onChange={(element) => setCurrentAnswer(element.target.value)}
                  placeholder="Input answer here"
                />
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (questions != undefined) {
                  checkWithAI({
                    question: questions[currentQuestion],
                    answer: currentAnswer,
                  });
                }
              }}
              className="hover:cursor-pointer"
              variant="soft"
              loading={isCheckingWithAI}
            >
              Check With AI ✨
            </Button>
            <button className="underline">How do I do this?</button>
          </div>
        </div>
      </div>
      <ChatWithAI></ChatWithAI>
    </div>
  );
}
